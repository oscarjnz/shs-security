#!/usr/bin/env bash
#
# S.S.S Scanner Agent - Instalador para macOS y Linux
# ────────────────────────────────────────────────────
# Uso tipico (el cliente pega esto en su Terminal):
#
#   curl -fsSL https://securitysmartservices.site/install.sh | sh
#
# Variables que puedes setear antes para personalizar:
#   SHS_INSTALL_DIR    Default: /usr/local/bin
#   SHS_VERSION        Default: latest. Si fijas un tag que no existe,
#                      el instalador cae automaticamente a la ultima release.
#   SHS_NO_SERVICE=1   No registrar como servicio del sistema
#   SHS_GITHUB_REPO    Default: oscarjnz/shs-scanner-agent
#
set -e

GITHUB_REPO="${SHS_GITHUB_REPO:-oscarjnz/shs-scanner-agent}"
INSTALL_DIR="${SHS_INSTALL_DIR:-/usr/local/bin}"
VERSION="${SHS_VERSION:-latest}"
BIN_NAME="shs-scanner"

# ─── Colores ──────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m')
  RED=$(printf '\033[31m'); GREEN=$(printf '\033[32m'); YELLOW=$(printf '\033[33m')
  BLUE=$(printf '\033[34m'); RESET=$(printf '\033[0m')
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

step()    { printf "${BLUE}>${RESET} %s\n" "$1"; }
success() { printf "${GREEN}OK${RESET} %s\n" "$1"; }
warn()    { printf "${YELLOW}!${RESET}  %s\n" "$1"; }
err()     { printf "${RED}x${RESET} %s\n" "$1" >&2; }

cleanup() {
  [ -n "${TMP_DIR:-}" ] && rm -rf "$TMP_DIR" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ─── Deteccion de OS y arquitectura ──────────────────────────────
detect_platform() {
  local os arch
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)

  case "$os" in
    darwin) OS="macos" ;;
    linux)  OS="linux" ;;
    *)
      err "Sistema operativo no soportado: $os"
      err "Este instalador funciona en macOS y Linux. Para Windows usa install.ps1"
      exit 1
      ;;
  esac

  case "$arch" in
    x86_64|amd64)  ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)
      err "Arquitectura no soportada: $arch"
      exit 1
      ;;
  esac

  # En Mac arm64 seria Apple Silicon; x64 seria Intel
  ASSET="shs-scanner-${OS}-${ARCH}"
  # OJO: un 'A && B && C' como ultima linea devuelve no-cero si A o B son falsos,
  # y con 'set -e' eso MATA el script en silencio. Por eso usamos un if explicito.
  if [ "$OS" = "macos" ] && [ "$ARCH" = "x64" ]; then
    ASSET="shs-scanner-macos-x64"
  fi
}

# ─── Linux: detectar distribucion ────────────────────────────────
detect_distro() {
  if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    DISTRO="${ID:-unknown}"
  else
    DISTRO="unknown"
  fi
}

# ─── nmap: chequear instalacion, sugerir como instalarlo ─────────
check_nmap() {
  if command -v nmap >/dev/null 2>&1; then
    success "nmap detectado: $(nmap --version | head -1)"
    return 0
  fi

  warn "nmap no esta instalado. Sin el, el escaner no podra auditar tu red."
  echo
  echo "  ${BOLD}Como instalarlo:${RESET}"
  if [ "$OS" = "macos" ]; then
    echo "    brew install nmap         ${DIM}# requiere Homebrew (brew.sh)${RESET}"
  else
    case "$DISTRO" in
      ubuntu|debian|raspbian)
        echo "    sudo apt update && sudo apt install -y nmap"
        ;;
      fedora|rhel|centos|rocky|almalinux)
        echo "    sudo dnf install -y nmap   ${DIM}# o 'yum install nmap' en sistemas viejos${RESET}"
        ;;
      arch|manjaro|endeavouros)
        echo "    sudo pacman -S --noconfirm nmap"
        ;;
      alpine)
        echo "    sudo apk add nmap"
        ;;
      *)
        echo "    Usa el gestor de paquetes de $DISTRO para instalar 'nmap'"
        ;;
    esac
  fi
  echo
  echo "  El escaner se instala igual, pero el comando ${BOLD}shs-scanner doctor${RESET} te avisara"
  echo "  hasta que tengas nmap funcionando."
  echo
}

# ─── Permisos: necesitamos escribir en INSTALL_DIR ───────────────
ensure_writable() {
  if [ ! -d "$INSTALL_DIR" ]; then
    if [ -w "$(dirname "$INSTALL_DIR")" ]; then
      mkdir -p "$INSTALL_DIR"
    else
      SUDO="sudo"
      $SUDO mkdir -p "$INSTALL_DIR"
    fi
  fi

  if [ -w "$INSTALL_DIR" ]; then
    SUDO=""
  else
    if command -v sudo >/dev/null 2>&1; then
      SUDO="sudo"
      step "Necesitamos privilegios de administrador para instalar en $INSTALL_DIR"
    else
      err "No tienes permiso de escritura en $INSTALL_DIR y 'sudo' no esta disponible."
      err "Reintenta con SHS_INSTALL_DIR=\$HOME/.local/bin sh install.sh"
      exit 1
    fi
  fi
}

# ─── Descarga: helper que baja una URL con curl o wget ───────────
# Devuelve 0 si descargo el archivo; distinto de 0 si fallo (404, red...).
fetch_to() {
  _url="$1"; _out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$_out" "$_url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$_out" "$_url"
  else
    err "Necesitas 'curl' o 'wget' instalado. Ninguno de los dos esta disponible."
    exit 1
  fi
}

# ─── Descarga del binario ────────────────────────────────────────
# Robusto: intenta la version pedida y, si no se puede bajar (tag que no
# existe, una variable SHS_VERSION vieja en el entorno, un proxy, etc.),
# cae automaticamente a la ultima release. Asi el instalador nunca muere
# en un 404 por una version mal fijada.
download_binary() {
  TMP_DIR=$(mktemp -d)
  latest_url="https://github.com/${GITHUB_REPO}/releases/latest/download/${ASSET}"

  if [ -z "$VERSION" ] || [ "$VERSION" = "latest" ]; then
    primary_url="$latest_url"
  else
    primary_url="https://github.com/${GITHUB_REPO}/releases/download/${VERSION}/${ASSET}"
  fi

  step "Descargando $ASSET ($([ "$VERSION" = "latest" ] && echo "ultima version" || echo "$VERSION"))..."

  if fetch_to "$primary_url" "$TMP_DIR/$BIN_NAME"; then
    :
  elif [ "$primary_url" != "$latest_url" ]; then
    warn "La version '$VERSION' no se pudo descargar. Usando la ultima version disponible..."
    if ! fetch_to "$latest_url" "$TMP_DIR/$BIN_NAME"; then
      err "No se pudo descargar el binario (ni '$VERSION' ni la ultima version)."
      err "Verifica tu conexion o consulta https://github.com/${GITHUB_REPO}/releases"
      exit 1
    fi
  else
    err "No se pudo descargar de $primary_url"
    err "Verifica tu conexion a internet o consulta https://github.com/${GITHUB_REPO}/releases"
    exit 1
  fi

  chmod +x "$TMP_DIR/$BIN_NAME"

  # ─── Sanity check del archivo descargado ──────────────────────
  # Si el servidor devolvio un HTML de error (404 disfrazado, captive portal,
  # proxy corporativo) o un asset incompleto, el "binario" no es ejecutable.
  # Antes de pedirle que corra, miramos su tamano y tipo.
  bin_size=$(wc -c < "$TMP_DIR/$BIN_NAME" 2>/dev/null | tr -d ' ')
  if [ -z "$bin_size" ] || [ "$bin_size" -lt 1000000 ]; then
    err "El archivo descargado es demasiado pequeno (${bin_size:-0} bytes)."
    err "Probablemente el servidor devolvio una pagina de error en vez del binario."
    err "Primeras lineas de lo que llego:"
    head -c 400 "$TMP_DIR/$BIN_NAME" 2>/dev/null | sed 's/^/    /' >&2 || true
    echo >&2
    exit 1
  fi

  # ─── macOS: firma ad-hoc obligatoria en Apple Silicon ─────────
  # En arm64 (y cada vez mas en Intel) el kernel exige al menos una firma
  # ad-hoc para ejecutar un binario. Sin ella, el proceso muere al instante
  # con "Killed: 9" antes de imprimir nada. Los binarios producidos por pkg
  # salen sin firma, asi que la aplicamos aqui.
  if [ "$OS" = "macos" ]; then
    if command -v codesign >/dev/null 2>&1; then
      step "Aplicando firma ad-hoc (necesaria en Apple Silicon)..."
      if ! codesign --sign - --force --preserve-metadata=entitlements,requirements,flags,runtime "$TMP_DIR/$BIN_NAME" 2>/dev/null; then
        # Reintento sin --preserve-metadata por si el binario no tenia firma previa.
        codesign --sign - --force "$TMP_DIR/$BIN_NAME" 2>/dev/null || true
      fi
    else
      warn "No encuentro 'codesign'. Si el binario no arranca, instala las Command Line Tools de Xcode:"
      warn "  xcode-select --install"
    fi
    # Quita el atributo de cuarentena por si curl/algun proxy lo seto.
    xattr -d com.apple.quarantine "$TMP_DIR/$BIN_NAME" 2>/dev/null || true
  fi

  # ─── Verificacion: corremos `version` y capturamos toda la salida ──
  # Antes solo mirabamos el codigo de salida. Eso era inutil cuando el kernel
  # mataba el proceso: el usuario solo veia "no se ejecuta correctamente".
  # Ahora mostramos stderr+stdout y, en macOS, el codigo de senal (137 = SIGKILL,
  # casi siempre por firma; 9 mostrado por el shell es lo mismo).
  verify_output=$("$TMP_DIR/$BIN_NAME" version 2>&1) || verify_rc=$?
  verify_rc=${verify_rc:-0}
  if [ "$verify_rc" -ne 0 ]; then
    err "El binario descargado no arranco (codigo $verify_rc)."
    if [ -n "$verify_output" ]; then
      err "Salida:"
      printf '%s\n' "$verify_output" | sed 's/^/    /' >&2
    fi
    case "$verify_rc" in
      137|9)
        err "Codigo 137/9 = SIGKILL. En macOS esto suele ser firma de codigo invalida."
        err "Reinstala las Command Line Tools y vuelve a intentar:"
        err "  xcode-select --install"
        ;;
      126|127)
        err "Codigo $verify_rc = el archivo no es ejecutable o falta una libreria."
        err "Asegurate de que tu sistema es ${OS}/${ARCH}."
        ;;
    esac
    exit 1
  fi

  $SUDO mv "$TMP_DIR/$BIN_NAME" "$INSTALL_DIR/$BIN_NAME"
  success "Instalado en $INSTALL_DIR/$BIN_NAME (version $(printf '%s' "$verify_output" | head -1))"
}

# ─── Servicio del sistema (systemd / launchd) ────────────────────
install_systemd_service() {
  local service_file="/etc/systemd/system/shs-scanner.service"
  local current_user="${SUDO_USER:-$USER}"

  step "Registrando servicio systemd..."

  cat <<EOF | $SUDO tee "$service_file" >/dev/null
[Unit]
Description=S.S.S Scanner Agent
Documentation=https://github.com/${GITHUB_REPO}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/${BIN_NAME} start
Restart=on-failure
RestartSec=10
User=${current_user}
StandardOutput=journal
StandardError=journal

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${HOME}/.config/shs-scanner

[Install]
WantedBy=multi-user.target
EOF

  $SUDO systemctl daemon-reload
  success "Servicio creado en $service_file"
  echo
  echo "  ${BOLD}Para arrancarlo automaticamente al boot:${RESET}"
  echo "    sudo systemctl enable --now shs-scanner"
  echo
  echo "  ${BOLD}Para ver su estado:${RESET}"
  echo "    sudo systemctl status shs-scanner"
  echo "    sudo journalctl -u shs-scanner -f"
}

install_launchd_service() {
  # NOTE: el plist es para el USUARIO actual ($HOME/Library/LaunchAgents/...),
  # NUNCA para LaunchDaemons (que requeriria root y romperia el contexto del
  # usuario). Por eso este paso no se hace con sudo, aunque la copia del binario
  # si lo haya necesitado.
  local user_home target_user plist uid
  target_user="${SUDO_USER:-$USER}"
  # Cuando el script corre con sudo, $HOME apunta a /var/root. Necesitamos el
  # home del usuario real para que LaunchAgents/Logs queden en su sitio.
  if [ -n "${SUDO_USER:-}" ]; then
    user_home=$(eval echo "~${SUDO_USER}")
  else
    user_home="$HOME"
  fi
  plist="$user_home/Library/LaunchAgents/com.shs.scanner.plist"

  step "Registrando servicio launchd (usuario: $target_user)..."
  mkdir -p "$user_home/Library/LaunchAgents" "$user_home/Library/Logs"

  # Si habia un plist viejo cargado, lo descargamos primero para evitar el
  # famoso "Load failed: 5: Input/output error" (que ocurre cuando intentas
  # cargar un plist con el mismo Label que uno ya activo, o cuando el plist
  # apunta a un binario que no existe).
  uid=$(id -u "$target_user")
  if [ -f "$plist" ]; then
    sudo -u "$target_user" launchctl bootout "gui/$uid/com.shs.scanner" 2>/dev/null || \
      sudo -u "$target_user" launchctl unload "$plist" 2>/dev/null || true
  fi

  cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.shs.scanner</string>
  <key>ProgramArguments</key>
  <array>
    <string>${INSTALL_DIR}/${BIN_NAME}</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>
  <dict>
    <key>Crashed</key><true/>
    <key>SuccessfulExit</key><false/>
  </dict>
  <key>StandardOutPath</key><string>${user_home}/Library/Logs/shs-scanner.log</string>
  <key>StandardErrorPath</key><string>${user_home}/Library/Logs/shs-scanner.error.log</string>
</dict>
</plist>
EOF

  # Asegura que el plist pertenezca al usuario, no a root (si corrimos con sudo).
  if [ -n "${SUDO_USER:-}" ]; then
    chown "$SUDO_USER" "$plist" 2>/dev/null || true
  fi

  # Auto-arranque: bootstrap es lo moderno; `load -w` esta deprecado en
  # Tahoe y suele fallar con "Input/output error".
  step "Arrancando el servicio..."
  if sudo -u "$target_user" launchctl bootstrap "gui/$uid" "$plist" 2>/dev/null; then
    success "Servicio arrancado (com.shs.scanner)"
  elif sudo -u "$target_user" launchctl load -w "$plist" 2>/dev/null; then
    success "Servicio arrancado (con 'load' clasico)"
  else
    warn "No pude arrancar el servicio automaticamente. Pruebalo a mano:"
    warn "  launchctl bootstrap gui/\$(id -u) $plist"
    warn "  # o si tu macOS es viejo:"
    warn "  launchctl load -w $plist"
  fi

  echo
  echo "  ${BOLD}Logs:${RESET}"
  echo "    tail -f $user_home/Library/Logs/shs-scanner.log"
}

install_service() {
  if [ "${SHS_NO_SERVICE:-0}" = "1" ]; then
    warn "Saltando instalacion de servicio (SHS_NO_SERVICE=1)"
    return
  fi

  if [ "$OS" = "linux" ] && command -v systemctl >/dev/null 2>&1; then
    install_systemd_service
  elif [ "$OS" = "macos" ]; then
    install_launchd_service
  else
    warn "No detecte systemd ni launchd. El agente se instalo pero no como servicio."
    warn "Arrancalo manualmente con: $BIN_NAME start"
  fi
}

# ─── PATH check ──────────────────────────────────────────────────
verify_in_path() {
  if ! command -v "$BIN_NAME" >/dev/null 2>&1; then
    warn "$INSTALL_DIR no parece estar en tu PATH."
    warn "Anadelo a tu shell rc (.bashrc / .zshrc):"
    echo "    export PATH=\"$INSTALL_DIR:\$PATH\""
    echo
    echo "  O ejecuta el agente con su ruta completa: $INSTALL_DIR/$BIN_NAME"
  fi
}

# ─── Pantalla final con proximos pasos ───────────────────────────
final_instructions() {
  echo
  printf "${GREEN}${BOLD}OK Instalacion completada.${RESET}\n"
  echo
  echo "${BOLD}Proximos pasos:${RESET}"
  echo
  echo "  ${BOLD}1.${RESET} Genera un codigo de emparejamiento en tu dashboard de S.S.S:"
  echo "     ${DIM}https://securitysmartservices.site/settings/scanners${RESET}"
  echo
  echo "  ${BOLD}2.${RESET} Empareja este agente con tu cuenta:"
  echo "     ${BOLD}$BIN_NAME pair <codigo>${RESET}"
  echo
  echo "  ${BOLD}3.${RESET} Verifica todo con el diagnostico:"
  echo "     ${BOLD}$BIN_NAME doctor${RESET}"
  echo
  echo "  ${BOLD}4.${RESET} Arranca el agente (o deja que el servicio lo haga al iniciar):"
  echo "     ${BOLD}$BIN_NAME start${RESET}"
  echo
  echo "  ${DIM}Para desinstalar en cualquier momento:${RESET}"
  echo "     ${DIM}curl -fsSL https://securitysmartservices.site/uninstall.sh | sh${RESET}"
  echo
}

# ─── Main ────────────────────────────────────────────────────────
main() {
  echo
  printf "${BOLD}S.S.S Scanner Agent - Instalador${RESET}\n"
  echo

  detect_platform
  step "Sistema detectado: $OS / $ARCH"

  if [ "$OS" = "linux" ]; then
    detect_distro
    step "Distribucion: $DISTRO"
  fi

  check_nmap
  ensure_writable
  download_binary
  install_service
  verify_in_path
  final_instructions
}

main "$@"
