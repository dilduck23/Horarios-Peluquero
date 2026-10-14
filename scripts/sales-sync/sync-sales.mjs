import sql from 'mssql';

const required = ['SQLSERVER_HOST', 'SQLSERVER_DATABASE', 'SQLSERVER_USER', 'SQLSERVER_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Falta la variable ${name}`);
}

const dateArg = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
const ecuadorDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const targetDate = dateArg || ecuadorDate();

const config = {
  server: process.env.SQLSERVER_HOST,
  port: Number(process.env.SQLSERVER_PORT || 1433),
  database: process.env.SQLSERVER_DATABASE,
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  options: {
    encrypt: String(process.env.SQLSERVER_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: String(process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false'
  },
  pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 120000,
  connectionTimeout: 30000
};

const aggregateSql = `
WITH documents AS (
  SELECT c.id, c.vendedor AS id_vendedor,
         COALESCE(NULLIF(LTRIM(RTRIM(c.nombreVendedor)), ''), CONCAT('Vendedor ', c.vendedor)) AS nombre_vendedor,
         CASE WHEN UPPER(c.DesDocumento) = 'FACTURA' THEN 1 ELSE -1 END AS signo,
         CASE WHEN UPPER(c.DesDocumento) = 'FACTURA' THEN 1 ELSE 0 END AS es_factura,
         CASE WHEN UPPER(c.DesDocumento) = 'NOTA DE CREDITO' THEN 1 ELSE 0 END AS es_nota,
         CONVERT(decimal(18,4), COALESCE(c.total, 0)) AS total
  FROM PCGN.dbo.MovimientosCabecerasVentasReal c
  WHERE c.fechaEmision >= @startDate
    AND c.fechaEmision < DATEADD(day, 1, @startDate)
    AND c.estado = 'A'
    AND UPPER(c.DesDocumento) IN ('FACTURA', 'NOTA DE CREDITO')
    AND c.vendedor IS NOT NULL
), detail_totals AS (
  SELECT d.cabecera,
         SUM(CASE WHEN UPPER(CONVERT(nvarchar(max), COALESCE(d.descripcion, ''))) LIKE '%[[]OBSEQUIO]%' THEN 0 ELSE COALESCE(d.cantidad, 0) END) AS items,
         SUM(CASE WHEN UPPER(CONVERT(nvarchar(max), COALESCE(d.descripcion, ''))) LIKE '%[[]OBSEQUIO]%' THEN COALESCE(d.cantidad, 0) ELSE 0 END) AS gifts
  FROM PCGN.dbo.MovimientoDetallesVentas d
  INNER JOIN documents doc ON doc.id = d.cabecera
  GROUP BY d.cabecera
)
SELECT doc.id_vendedor, MAX(doc.nombre_vendedor) AS nombre_vendedor,
       SUM(doc.es_factura) AS facturas, SUM(doc.es_nota) AS notas_credito,
       SUM(CASE WHEN doc.es_factura = 1 THEN doc.total ELSE 0 END) AS ventas_brutas,
       SUM(CASE WHEN doc.es_nota = 1 THEN doc.total ELSE 0 END) AS devoluciones,
       SUM(doc.signo * doc.total) AS ventas_netas,
       SUM(doc.signo * COALESCE(dt.items, 0)) AS items_netos,
       SUM(doc.signo * COALESCE(dt.gifts, 0)) AS items_obsequio
FROM documents doc
LEFT JOIN detail_totals dt ON dt.cabecera = doc.id
GROUP BY doc.id_vendedor
ORDER BY nombre_vendedor;`;

const productsSql = `
WITH documents AS (
  SELECT c.id, c.vendedor AS id_vendedor,
         CASE WHEN UPPER(c.DesDocumento) = 'FACTURA' THEN 1 ELSE -1 END AS signo
  FROM PCGN.dbo.MovimientosCabecerasVentasReal c
  WHERE c.fechaEmision >= @startDate
    AND c.fechaEmision < DATEADD(day, 1, @startDate)
    AND c.estado = 'A'
    AND UPPER(c.DesDocumento) IN ('FACTURA', 'NOTA DE CREDITO')
    AND c.vendedor IS NOT NULL
)
SELECT doc.id_vendedor, mp.idProveedor AS id_proveedor,
       MAX(mp.ProveedorNombre) AS proveedor,
       CONVERT(nvarchar(80), COALESCE(NULLIF(a.codigo, ''), CONCAT('ART-', a.id))) AS codigo_producto,
       MAX(COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(500), d.descripcion))), ''), CONVERT(nvarchar(500), a.descripcion), 'Producto')) AS producto,
       SUM(doc.signo * COALESCE(d.cantidad, 0)) AS cantidad_neta,
       SUM(doc.signo * COALESCE(d.total, 0)) AS venta_neta
FROM documents doc
INNER JOIN PCGN.dbo.MovimientoDetallesVentas d ON d.cabecera = doc.id
INNER JOIN PCGN.dbo.ARTICULO a ON a.id = d.articulo
INNER JOIN PCGN.dbo.vw_Marcas_Proveedores_App mp ON mp.idMarca = a.idMarca
WHERE UPPER(CONVERT(nvarchar(max), COALESCE(d.descripcion, ''))) NOT LIKE '%[[]OBSEQUIO]%'
  AND mp.idProveedor IS NOT NULL
GROUP BY doc.id_vendedor, mp.idProveedor, CONVERT(nvarchar(80), COALESCE(NULLIF(a.codigo, ''), CONCAT('ART-', a.id)))
HAVING ABS(SUM(doc.signo * COALESCE(d.cantidad, 0))) > 0.0001
    OR ABS(SUM(doc.signo * COALESCE(d.total, 0))) > 0.0001
ORDER BY doc.id_vendedor, proveedor, producto;`;

function plainRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? null : typeof value === 'number' ? value : String(value)])));
}

async function upload(ventas, productos) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/sincronizar_ventas_diarias`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_fecha: targetDate, p_ventas: ventas, p_productos: productos })
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${body.slice(0, 400)}`);
  return body ? JSON.parse(body) : {};
}

let pool;
try {
  pool = await sql.connect(config);
  const [dailyResult, productResult] = await Promise.all([
    pool.request().input('startDate', sql.Date, targetDate).query(aggregateSql),
    pool.request().input('startDate', sql.Date, targetDate).query(productsSql)
  ]);
  const result = await upload(plainRows(dailyResult.recordset), plainRows(productResult.recordset));
  console.log(JSON.stringify({ ok: true, fecha: targetDate, ...result }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, fecha: targetDate, error: error.message }));
  process.exitCode = 1;
} finally {
  if (pool) await pool.close();
}
