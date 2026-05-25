/*
 * Static mapping of common ports → notable, well-known CVEs.
 * NOT a vulnerability scanner: detecting an open port does NOT mean the
 * underlying service is vulnerable. These are educational suggestions of
 * "things to check / read about" when a given port is reachable from the
 * public internet.
 *
 * Curated for the SSS demo. Each CVE listed must be famous enough that the
 * end-user will find context in NVD/Exploit-DB easily. Severity is the rough
 * CVSS family bucket, refined later when we enrich with NVD.
 */

export interface PortCveSuggestion {
  cveId: string;
  shortName: string;
  why: string; // why we surface this CVE for this port (Spanish, plain)
}

export const PORT_CVE_MAP: Record<number, PortCveSuggestion[]> = {
  21: [
    {
      cveId: "CVE-2011-2523",
      shortName: "vsftpd 2.3.4 backdoor",
      why: "FTP en el puerto 21 fue blanco de un famoso backdoor en vsftpd que abre una shell.",
    },
  ],
  22: [
    {
      cveId: "CVE-2018-15473",
      shortName: "OpenSSH username enumeration",
      why: "SSH expuesto permite enumeración de usuarios en versiones antiguas de OpenSSH.",
    },
    {
      cveId: "CVE-2016-0777",
      shortName: "OpenSSH roaming info leak",
      why: "Cliente SSH expuesto a fuga de claves privadas si se conecta a servidor malicioso.",
    },
  ],
  23: [
    {
      cveId: "CVE-2020-10188",
      shortName: "telnetd buffer overflow",
      why: "Telnet ya es inseguro por diseño (texto plano). Además acumula vulns críticas como esta.",
    },
  ],
  25: [
    {
      cveId: "CVE-2020-28017",
      shortName: "Exim integer overflow",
      why: "SMTP expuesto permite RCE en servidores Exim sin parchear (21Nails).",
    },
  ],
  53: [
    {
      cveId: "CVE-2020-1350",
      shortName: "SIGRed (Windows DNS)",
      why: "DNS expuesto en Windows Server vulnerable a RCE wormable.",
    },
  ],
  80: [
    {
      cveId: "CVE-2021-41773",
      shortName: "Apache path traversal",
      why: "HTTP en Apache 2.4.49/2.4.50 permite leer archivos del servidor y RCE.",
    },
    {
      cveId: "CVE-2021-44228",
      shortName: "Log4Shell",
      why: "Cualquier servicio HTTP que loguee headers con Log4j vulnerable era explotable remotamente.",
    },
  ],
  110: [
    {
      cveId: "CVE-2007-1558",
      shortName: "APOP MD5 weakness",
      why: "POP3 sin TLS expone credenciales y es vulnerable a downgrade.",
    },
  ],
  143: [
    {
      cveId: "CVE-2021-38371",
      shortName: "Dovecot IMAP STARTTLS",
      why: "IMAP expuesto vulnerable a inyección de comandos en sesión STARTTLS.",
    },
  ],
  443: [
    {
      cveId: "CVE-2014-0160",
      shortName: "Heartbleed",
      why: "HTTPS con OpenSSL vulnerable filtra memoria del servidor (claves privadas, sesiones).",
    },
    {
      cveId: "CVE-2021-44228",
      shortName: "Log4Shell",
      why: "Mismo Log4Shell, sobre HTTPS.",
    },
  ],
  445: [
    {
      cveId: "CVE-2017-0144",
      shortName: "EternalBlue (SMB)",
      why: "SMB expuesto en internet fue el vector de WannaCry y NotPetya. Cerrar SIEMPRE.",
    },
    {
      cveId: "CVE-2020-0796",
      shortName: "SMBGhost",
      why: "RCE wormable en SMBv3 de Windows 10/Server 2019 sin parchear.",
    },
  ],
  587: [
    {
      cveId: "CVE-2020-28018",
      shortName: "Exim use-after-free",
      why: "Submission SMTP expuesto en Exim sin parchear permite RCE.",
    },
  ],
  993: [
    {
      cveId: "CVE-2021-38371",
      shortName: "Dovecot IMAPS",
      why: "IMAP sobre TLS sigue vulnerable a inyección de comandos en versiones antiguas.",
    },
  ],
  995: [
    {
      cveId: "CVE-2007-1558",
      shortName: "POP3S downgrade",
      why: "Pese a TLS, clientes antiguos pueden caer a APOP con MD5.",
    },
  ],
  1433: [
    {
      cveId: "CVE-2020-0618",
      shortName: "MSSQL Reporting Services",
      why: "SQL Server expuesto a internet es siempre alto riesgo. Esta es una de muchas RCE.",
    },
  ],
  1883: [
    {
      cveId: "CVE-2017-7650",
      shortName: "Mosquitto MQTT auth bypass",
      why: "MQTT (IoT) sin auth expuesto = control de todos los dispositivos conectados.",
    },
  ],
  3306: [
    {
      cveId: "CVE-2012-2122",
      shortName: "MySQL auth bypass",
      why: "MySQL expuesto a internet fue vulnerable a bypass repitiendo intentos de login.",
    },
  ],
  3389: [
    {
      cveId: "CVE-2019-0708",
      shortName: "BlueKeep (RDP)",
      why: "RDP expuesto vulnerable a RCE wormable. Aún hoy es uno de los vectores más explotados.",
    },
    {
      cveId: "CVE-2019-1181",
      shortName: "DejaBlue (RDP)",
      why: "Familia de RCE RDP descubiertas tras BlueKeep.",
    },
  ],
  5432: [
    {
      cveId: "CVE-2019-9193",
      shortName: "PostgreSQL COPY FROM",
      why: "PostgreSQL expuesto permitía ejecución de comandos vía COPY en versiones <11.3.",
    },
  ],
  5900: [
    {
      cveId: "CVE-2019-15681",
      shortName: "LibVNCServer memleak",
      why: "VNC expuesto al internet equivale a regalar pantalla y teclado. Además acumula RCE.",
    },
  ],
  6379: [
    {
      cveId: "CVE-2022-0543",
      shortName: "Redis Lua sandbox escape",
      why: "Redis expuesto sin auth permite escape de sandbox y RCE.",
    },
  ],
  8080: [
    {
      cveId: "CVE-2017-12615",
      shortName: "Tomcat PUT JSP RCE",
      why: "Tomcat en 8080 con PUT habilitado permite subir JSP y RCE.",
    },
  ],
  9200: [
    {
      cveId: "CVE-2015-1427",
      shortName: "Elasticsearch Groovy RCE",
      why: "Elasticsearch nunca debe estar expuesto: histórico de RCE críticas sin auth.",
    },
  ],
  11211: [
    {
      cveId: "CVE-2018-1000115",
      shortName: "Memcached UDP amplification",
      why: "Memcached UDP expuesto sirve para ataques DDoS masivos contra terceros.",
    },
  ],
  27017: [
    {
      cveId: "CVE-2019-2386",
      shortName: "MongoDB auth bypass",
      why: "MongoDB expuesto sin auth = exfiltración masiva. Vector clásico de ransomware.",
    },
  ],
};

export function suggestCvesForPort(port: number): PortCveSuggestion[] {
  return PORT_CVE_MAP[port] ?? [];
}

export function suggestCvesForPorts(ports: number[]): {
  port: number;
  suggestions: PortCveSuggestion[];
}[] {
  return ports
    .map((p) => ({ port: p, suggestions: suggestCvesForPort(p) }))
    .filter((x) => x.suggestions.length > 0);
}
