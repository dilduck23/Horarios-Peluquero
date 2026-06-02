-- ============================================
-- CATALOGO DE MARCAS Y PROVEEDORES - StaffPlanner
-- Ejecutar despues de supabase_security_policies.sql
-- Fuente: Listado_Marcas_Con_Stock_2026-06-02.xlsx
-- ============================================

CREATE TABLE IF NOT EXISTS public."Tiendas_Marcas_Proveedores" (
    "idMarca" INTEGER PRIMARY KEY,
    marca TEXT NOT NULL,
    "idProveedor" INTEGER NOT NULL,
    proveedor TEXT NOT NULL,
    correo_proveedor TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public."Tiendas_Marcas_Proveedores"
IS 'Catalogo de marcas registradas con su proveedor principal y correo compartido para impulsadoras.';

COMMENT ON COLUMN public."Tiendas_Marcas_Proveedores".correo_proveedor
IS 'Correo compartido del proveedor para todas sus marcas.';

CREATE INDEX IF NOT EXISTS idx_marcas_proveedores_marca
ON public."Tiendas_Marcas_Proveedores" (marca);

CREATE INDEX IF NOT EXISTS idx_marcas_proveedores_proveedor
ON public."Tiendas_Marcas_Proveedores" ("idProveedor");

ALTER TABLE public."Tiendas_Marcas_Proveedores" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marcas_proveedores_select_public" ON public."Tiendas_Marcas_Proveedores";
DROP POLICY IF EXISTS "marcas_proveedores_write_managers" ON public."Tiendas_Marcas_Proveedores";

CREATE POLICY "marcas_proveedores_select_public" ON public."Tiendas_Marcas_Proveedores"
FOR SELECT TO public USING (true);

CREATE POLICY "marcas_proveedores_write_managers" ON public."Tiendas_Marcas_Proveedores"
FOR ALL TO authenticated USING (private.staffplanner_role_id() IN (1, 2))
WITH CHECK (private.staffplanner_role_id() IN (1, 2));

WITH incoming AS (
    SELECT *
    FROM jsonb_to_recordset($catalog$
[
  {"idMarca":349,"marca":"BE NATURAL","idProveedor":4223,"proveedor":"360 CORP. S.A"},
  {"idMarca":1283,"marca":"ESSENCE","idProveedor":4223,"proveedor":"360 CORP. S.A"},
  {"idMarca":1803,"marca":"LOREAL PROFESSIONNEL","idProveedor":4223,"proveedor":"360 CORP. S.A"},
  {"idMarca":1500,"marca":"PLACENTA LIFE","idProveedor":4223,"proveedor":"360 CORP. S.A"},
  {"idMarca":1346,"marca":"SANOII","idProveedor":2838,"proveedor":"ALVAREZ MORALES DIDIER FLADIMER"},
  {"idMarca":1705,"marca":"COQUETAS","idProveedor":4875,"proveedor":"AMAN GAMBOA MARCO ANTONIO"},
  {"idMarca":1819,"marca":"BIOESTETIC","idProveedor":5030,"proveedor":"AMAP COMERCIALIZADORA S.A.S."},
  {"idMarca":848,"marca":"BOT X LIKE","idProveedor":294,"proveedor":"BELLDIS S.A."},
  {"idMarca":779,"marca":"BIOTANIK","idProveedor":1601,"proveedor":"BIOTANICALS DEL ECUADOR S.A."},
  {"idMarca":1477,"marca":"CLANS","idProveedor":1601,"proveedor":"BIOTANICALS DEL ECUADOR S.A."},
  {"idMarca":1275,"marca":"PROLUX","idProveedor":4794,"proveedor":"CANTOS CHARCO RUTH MARIA"},
  {"idMarca":1228,"marca":"BOMPLAST","idProveedor":269,"proveedor":"CARLOS PATRICIO MONCAYO CARVAJAL"},
  {"idMarca":1227,"marca":"VANITY","idProveedor":269,"proveedor":"CARLOS PATRICIO MONCAYO CARVAJAL"},
  {"idMarca":1753,"marca":"OPI","idProveedor":4752,"proveedor":"CHEN HUAQIANG"},
  {"idMarca":1670,"marca":"LA VOUCHE","idProveedor":4781,"proveedor":"COMERCIALIZADORA ITALY COSMETIC ITALCOSIM S.A."},
  {"idMarca":1671,"marca":"ARKEMUSA","idProveedor":5011,"proveedor":"COSMESUR S.A.S"},
  {"idMarca":1456,"marca":"FAMASU","idProveedor":4427,"proveedor":"COSMETICOS CEVA S.A."},
  {"idMarca":1689,"marca":"MQ","idProveedor":4427,"proveedor":"COSMETICOS CEVA S.A."},
  {"idMarca":1818,"marca":"NATU HAIR","idProveedor":4427,"proveedor":"COSMETICOS CEVA S.A."},
  {"idMarca":787,"marca":"ALFAPARF","idProveedor":20,"proveedor":"COSMETICOS ECOS"},
  {"idMarca":1124,"marca":"MARYAM","idProveedor":4827,"proveedor":"COSMETICOS MARYAM ECUADOR COSMARYAM S.A."},
  {"idMarca":311,"marca":"IGORA PROFESIONAL","idProveedor":4921,"proveedor":"COSMOBELL CIA. LTDA."},
  {"idMarca":1079,"marca":"RODHER","idProveedor":21,"proveedor":"CRAFIKLES S.A."},
  {"idMarca":1100,"marca":"VOGUE","idProveedor":21,"proveedor":"CRAFIKLES S.A."},
  {"idMarca":1444,"marca":"HADASSHA","idProveedor":4081,"proveedor":"CRISTINA NATALY LUQUE VALIENTE"},
  {"idMarca":1782,"marca":"FRAUSS","idProveedor":26,"proveedor":"DIPROCOBE"},
  {"idMarca":565,"marca":"MOLLIE","idProveedor":26,"proveedor":"DIPROCOBE"},
  {"idMarca":1383,"marca":"BLOND.AA","idProveedor":2862,"proveedor":"DISGAMU S.A."},
  {"idMarca":1464,"marca":"JRL","idProveedor":2862,"proveedor":"DISGAMU S.A."},
  {"idMarca":1755,"marca":"KERAPLASMA","idProveedor":2862,"proveedor":"DISGAMU S.A."},
  {"idMarca":1776,"marca":"LISSAGE","idProveedor":2862,"proveedor":"DISGAMU S.A."},
  {"idMarca":1461,"marca":"PLASMA","idProveedor":2862,"proveedor":"DISGAMU S.A."},
  {"idMarca":1707,"marca":"DAMAR","idProveedor":4878,"proveedor":"DISTRIBUIDORA DE PRODUCTOS COSMETICOS DISPROCOSM S.A.S."},
  {"idMarca":1729,"marca":"MASTER NAILS","idProveedor":4337,"proveedor":"DISTRICOSMETIC S.A."},
  {"idMarca":1465,"marca":"AZEIDA","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":331,"marca":"BMT","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":1425,"marca":"BYPHASSE","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":529,"marca":"CHINA GLAZE","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":1009,"marca":"DUO","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":1387,"marca":"FIRENZE","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":1392,"marca":"FLORMAR","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":983,"marca":"KATIVA","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":422,"marca":"LISAP","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":1421,"marca":"RUDE","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":1544,"marca":"THE BARBERIA","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":610,"marca":"ULTRA BEAD","idProveedor":23,"proveedor":"DMUJERES"},
  {"idMarca":597,"marca":"ARDELL","idProveedor":4571,"proveedor":"DOUS IMPORT EXPORT S.A."},
  {"idMarca":1530,"marca":"BABARIA","idProveedor":4571,"proveedor":"DOUS IMPORT EXPORT S.A."},
  {"idMarca":944,"marca":"ISSUE","idProveedor":4571,"proveedor":"DOUS IMPORT EXPORT S.A."},
  {"idMarca":1382,"marca":"NOVEX","idProveedor":4571,"proveedor":"DOUS IMPORT EXPORT S.A."},
  {"idMarca":1523,"marca":"ISSUE","idProveedor":4571,"proveedor":"DOUS IMPORT EXPORT S.A."},
  {"idMarca":1086,"marca":"NIVEA","idProveedor":4818,"proveedor":"ECUAQUIMICA ECUATORIANA DE PRODUCTOS QUIMICOS CA"},
  {"idMarca":1232,"marca":"NUTRI HAIR","idProveedor":167,"proveedor":"ENVASADORA ECUATORIANA S.A"},
  {"idMarca":1662,"marca":"FARMAVITA","idProveedor":4779,"proveedor":"EUROSTYLE ECUADOR S.A.S."},
  {"idMarca":1815,"marca":"GREEN COLOR","idProveedor":4779,"proveedor":"EUROSTYLE ECUADOR S.A.S."},
  {"idMarca":1778,"marca":"TRICOGEN","idProveedor":4779,"proveedor":"EUROSTYLE ECUADOR S.A.S."},
  {"idMarca":1797,"marca":"BANDIDO","idProveedor":4976,"proveedor":"FOURBAND S.A.S."},
  {"idMarca":1442,"marca":"ANDRERIO","idProveedor":4347,"proveedor":"GICRO INDUSTRIA Y COMERCIO RIOS Y ORTIZ CIA. LTDA."},
  {"idMarca":585,"marca":"BITOR","idProveedor":39,"proveedor":"GRANDEX"},
  {"idMarca":871,"marca":"VANDUX","idProveedor":39,"proveedor":"GRANDEX"},
  {"idMarca":1494,"marca":"PRO YOU","idProveedor":44,"proveedor":"HYPERKALID S.A."},
  {"idMarca":1686,"marca":"ALEA PLEX","idProveedor":4816,"proveedor":"IBEROCOSMETICS S.A."},
  {"idMarca":1685,"marca":"CRIOXIDIL","idProveedor":4816,"proveedor":"IBEROCOSMETICS S.A."},
  {"idMarca":1395,"marca":"ITALY COLOR","idProveedor":4221,"proveedor":"IMPOGAMU S.A."},
  {"idMarca":1817,"marca":"ORIGEM","idProveedor":4221,"proveedor":"IMPOGAMU S.A."},
  {"idMarca":852,"marca":"GARNIER","idProveedor":46,"proveedor":"IMPORMASS S.A."},
  {"idMarca":354,"marca":"TONI & GUY","idProveedor":4950,"proveedor":"IMPORTADORA CLOVER"},
  {"idMarca":897,"marca":"KONAD","idProveedor":47,"proveedor":"IMPORTADORA G.B."},
  {"idMarca":743,"marca":"BIGEN","idProveedor":48,"proveedor":"IMPORTADORA LOOR"},
  {"idMarca":921,"marca":"PLUSCARE","idProveedor":4933,"proveedor":"JEPAR S.A.S."},
  {"idMarca":1057,"marca":"COLOR TONE","idProveedor":4375,"proveedor":"LA FABRIL S.A."},
  {"idMarca":992,"marca":"COLORET","idProveedor":4375,"proveedor":"LA FABRIL S.A."},
  {"idMarca":404,"marca":"HAR","idProveedor":4375,"proveedor":"LA FABRIL S.A."},
  {"idMarca":1378,"marca":"BEAUTIK","idProveedor":3937,"proveedor":"LABORATORIOS BEAUTIK S.A"},
  {"idMarca":394,"marca":"NEO PIL","idProveedor":57,"proveedor":"LABORATORIOS CARDY"},
  {"idMarca":1130,"marca":"MARIA JOSE","idProveedor":58,"proveedor":"LABORATORIOS JOSE QUIROZ"},
  {"idMarca":1102,"marca":"RENE CHARDON","idProveedor":89,"proveedor":"LABORATORIOS RENE CHARDON DEL ECUADOR"},
  {"idMarca":442,"marca":"SALOONIN","idProveedor":56,"proveedor":"LANSEY S.A."},
  {"idMarca":1046,"marca":"IGORA PUBLICO","idProveedor":62,"proveedor":"LAS FRAGANCIAS"},
  {"idMarca":872,"marca":"KOLESTON","idProveedor":62,"proveedor":"LAS FRAGANCIAS"},
  {"idMarca":1131,"marca":"NATURALEZA & VIDA","idProveedor":62,"proveedor":"LAS FRAGANCIAS"},
  {"idMarca":688,"marca":"ESSENTIAL","idProveedor":4771,"proveedor":"LILIANA PATRICIA ZAMBRANO REYES"},
  {"idMarca":1097,"marca":"KIEPE","idProveedor":214,"proveedor":"LUMOSEMP S.A"},
  {"idMarca":1792,"marca":"BEAUTY OF JOSEON","idProveedor":2902,"proveedor":"MACRONEGOCIOS S.A"},
  {"idMarca":1365,"marca":"E&A","idProveedor":2902,"proveedor":"MACRONEGOCIOS S.A"},
  {"idMarca":1580,"marca":"GELISH","idProveedor":2902,"proveedor":"MACRONEGOCIOS S.A"},
  {"idMarca":1468,"marca":"KUUL","idProveedor":2902,"proveedor":"MACRONEGOCIOS S.A"},
  {"idMarca":1795,"marca":"MIXSOON","idProveedor":2902,"proveedor":"MACRONEGOCIOS S.A"},
  {"idMarca":1428,"marca":"OSSION","idProveedor":2902,"proveedor":"MACRONEGOCIOS S.A"},
  {"idMarca":1370,"marca":"RUCHA","idProveedor":2902,"proveedor":"MACRONEGOCIOS S.A"},
  {"idMarca":764,"marca":"CHOCOLIFE","idProveedor":69,"proveedor":"MERCANPAZ S.A."},
  {"idMarca":1668,"marca":"ARGABETA","idProveedor":3963,"proveedor":"PALACIOS ASTUDILLO CHRISTIAN ARTURO"},
  {"idMarca":1363,"marca":"PROKPIL","idProveedor":3963,"proveedor":"PALACIOS ASTUDILLO CHRISTIAN ARTURO"},
  {"idMarca":1602,"marca":"CONTEMPORA","idProveedor":4709,"proveedor":"PHARMAWEL DISTRIBUIDORA DE PRODUCTOS PARA CUIDADO PERSONAL CIA LTDA"},
  {"idMarca":406,"marca":"GAMA","idProveedor":4709,"proveedor":"PHARMAWEL DISTRIBUIDORA DE PRODUCTOS PARA CUIDADO PERSONAL CIA LTDA"},
  {"idMarca":1796,"marca":"SKIN1004","idProveedor":4709,"proveedor":"PHARMAWEL DISTRIBUIDORA DE PRODUCTOS PARA CUIDADO PERSONAL CIA LTDA"},
  {"idMarca":518,"marca":"BABYLISS","idProveedor":50,"proveedor":"SANSUR IMPORTACIONES"},
  {"idMarca":1458,"marca":"KERACTIVE","idProveedor":50,"proveedor":"SANSUR IMPORTACIONES"},
  {"idMarca":324,"marca":"WAHL","idProveedor":50,"proveedor":"SANSUR IMPORTACIONES"},
  {"idMarca":1375,"marca":"SISTEMA CAPILAR","idProveedor":4335,"proveedor":"SISTEMA CAPILAR SISCAPSA S.A."},
  {"idMarca":1607,"marca":"COLOR1","idProveedor":4736,"proveedor":"VECARO IMPORTACIONES S.A."},
  {"idMarca":1698,"marca":"LOLA FROM RIO","idProveedor":4736,"proveedor":"VECARO IMPORTACIONES S.A."},
  {"idMarca":588,"marca":"MIA SECRET","idProveedor":4793,"proveedor":"VERSABEAUTY COSMETICOS Y SPA S.A.S"},
  {"idMarca":1785,"marca":"AGIVA","idProveedor":225,"proveedor":"ZARIMPORT S.A."},
  {"idMarca":1789,"marca":"LA POCION","idProveedor":225,"proveedor":"ZARIMPORT S.A."}
]
    $catalog$::jsonb) AS catalog("idMarca" INTEGER, marca TEXT, "idProveedor" INTEGER, proveedor TEXT)
)
INSERT INTO public."Tiendas_Marcas_Proveedores" ("idMarca", marca, "idProveedor", proveedor, activo, actualizado_en)
SELECT "idMarca", marca, "idProveedor", proveedor, true, NOW()
FROM incoming
ON CONFLICT ("idMarca") DO UPDATE
SET marca = EXCLUDED.marca,
    "idProveedor" = EXCLUDED."idProveedor",
    proveedor = EXCLUDED.proveedor,
    activo = true,
    actualizado_en = NOW();

WITH provider_emails("idProveedor", correo_proveedor) AS (
    VALUES
        (20, 'yhidalgo@alfaparf.com.ec'),
        (23, 'djimenez@macronegocios.ec'),
        (26, 'diego.diprocobe@hotmail.com'),
        (50, 'jsansur@sansur.com.ec'),
        (56, 't59@lansey.com'),
        (69, 'pzuniga@mercanpaz.com'),
        (89, 'geovanna.lopez@rchardon.com'),
        (214, 'ginger.jacome@lumosemp.com.ec'),
        (225, 'emartinez@lapocion.com'),
        (1601, 'isidrodapelo@biotanicals.net'),
        (2838, 'silviatulmomariscal@gmail.com'),
        (2902, 'djimenez@macronegocios.ec'),
        (3963, 'blancazhongor1@hotmail.com'),
        (4335, 'jmadrigal@sistemacapilarpro.com'),
        (4375, 'alliguin@lafabril.com.ec'),
        (4427, 'ccedeno@cosmeticosceva.com.ec'),
        (4571, 'Ventasgye@dous.ec'),
        (4709, 'ventascosta@pharmawel.com')
)
UPDATE public."Tiendas_Marcas_Proveedores" catalog
SET correo_proveedor = provider_emails.correo_proveedor,
    actualizado_en = NOW()
FROM provider_emails
WHERE catalog."idProveedor" = provider_emails."idProveedor"
  AND (catalog.correo_proveedor IS NULL OR btrim(catalog.correo_proveedor) = '');

-- Adaptacion de impulsadoras existentes con coincidencias seguras.
WITH brand_links(legacy_marca, "idMarca") AS (
    VALUES
        ('KUUL', 1468),
        ('ALFAPARF', 787),
        ('SALOON IN', 442),
        ('RENE CHARDON', 1102),
        ('CHARDON', 1102),
        ('CHOCOLIFE', 764),
        ('LA POCION', 1789),
        ('PROKPIL', 1363),
        ('DMUJERES', 1428),
        ('SISTEMA CAPILAR', 1375),
        ('SANO', 1346),
        ('KIEPE', 1097),
        ('FAMASU', 1456),
        ('FABRIL', 404),
        ('ANDRERIO', 1442),
        ('OSSION', 1428),
        ('ISSUE', 1382),
        ('SANSUR', 518),
        ('MOLLIE', 565),
        ('GAMA', 406),
        ('BIOTANIK', 779)
),
resolved AS (
    SELECT brand_links.legacy_marca, catalog.*
    FROM brand_links
    JOIN public."Tiendas_Marcas_Proveedores" catalog ON catalog."idMarca" = brand_links."idMarca"
)
UPDATE public."Tiendas_Impulsadoras" impulsadora
SET "Marca" = CASE
        WHEN resolved.legacy_marca IN ('DMUJERES', 'FABRIL', 'ISSUE', 'SANO', 'SANSUR')
        THEN resolved.marca
        ELSE impulsadora."Marca"
    END,
    "idMarca" = resolved."idMarca",
    "idProveedor" = resolved."idProveedor",
    "Proveedor" = resolved.proveedor,
    "Correo" = CASE
        WHEN resolved.correo_proveedor IS NOT NULL
             AND (
                impulsadora."Correo" IS NULL
                OR btrim(impulsadora."Correo") = ''
                OR btrim(impulsadora."Correo") = '0'
                OR resolved."idProveedor" = 4427
             )
        THEN resolved.correo_proveedor
        ELSE impulsadora."Correo"
    END
FROM resolved
WHERE upper(btrim(impulsadora."Marca")) = resolved.legacy_marca;
