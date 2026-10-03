CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.data_sources (id text PRIMARY KEY, name text NOT NULL, kind text NOT NULL, url text);
CREATE TABLE public.provinces (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE public.stations (
  id text PRIMARY KEY,
  name text NOT NULL,
  province_id text NOT NULL REFERENCES public.provinces(id),
  municipality text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geometry jsonb,
  capacity_mw numeric,
  operator text,
  station_type text NOT NULL DEFAULT 'Utility-scale',
  commissioning_date date,
  verification text NOT NULL DEFAULT 'demo' CHECK (verification IN ('verified','unverified','estimated','demo')),
  data_mode text NOT NULL DEFAULT 'demo' CHECK (data_mode IN ('real','demo')),
  source_id text REFERENCES public.data_sources(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id text NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  observed_at date NOT NULL,
  condition_score int NOT NULL CHECK (condition_score BETWEEN 0 AND 100),
  f_change int NOT NULL DEFAULT 0,
  f_anomaly int NOT NULL DEFAULT 0,
  f_trend int NOT NULL DEFAULT 0,
  f_quality int NOT NULL DEFAULT 0,
  quality text NOT NULL DEFAULT 'good' CHECK (quality IN ('good','fair','poor')),
  cloud_cover int,
  source_id text REFERENCES public.data_sources(id),
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.observations (station_id, observed_at);
CREATE TABLE public.problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id text NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('condition_change','area_anomaly','vegetation','visual_anomaly','data_issue')),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  description text NOT NULL,
  confidence int NOT NULL DEFAULT 70,
  detected_at date NOT NULL DEFAULT current_date,
  affected_pct numeric,
  action text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','confirmed')),
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.problems (station_id);
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id text NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  rule text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical','high','medium')),
  title text NOT NULL,
  message text NOT NULL,
  condition_from int,
  condition_to int,
  action text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')),
  created_at date NOT NULL DEFAULT current_date,
  resolved_at timestamptz
);
CREATE INDEX ON public.alerts (station_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['data_sources','provinces','stations','observations','problems','alerts'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Public read" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Admin insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''))', t);
    EXECUTE format('CREATE POLICY "Admin update" ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t);
    EXECUTE format('CREATE POLICY "Admin delete" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t);
  END LOOP;
END $$;

-- ---------- Seed: reference data ----------
INSERT INTO public.data_sources (id,name,kind,url) VALUES
('demo-monitoring','SolarScope demo monitoring engine','demo',NULL),
('sentinel2','Copernicus Sentinel-2 L2A','satellite','https://dataspace.copernicus.eu'),
('public-registry','Public information (press / regulator publications)','public',NULL),
('geoboundaries','geoBoundaries ADM1 (Armenia provinces)','geospatial','https://www.geoboundaries.org');

INSERT INTO public.provinces (id,name) VALUES ('aragatsotn','Aragatsotn'),('ararat','Ararat'),('armavir','Armavir'),('gegharkunik','Gegharkunik'),('kotayk','Kotayk'),('lori','Lori'),('shirak','Shirak'),('syunik','Syunik'),('tavush','Tavush'),('vayots-dzor','Vayots Dzor'),('yerevan','Yerevan');

-- ---------- Seed: demo stations (approximate locations near real towns) ----------
INSERT INTO public.stations (id,name,province_id,municipality,lat,lng,capacity_mw,station_type,verification,source_id)
SELECT 'AM-' || v.id, replace(v.name, '~', ' Solar Station'), v.prov, v.muni, v.lat, v.lng, v.mw,
  CASE WHEN v.mw >= 1 THEN 'Utility-scale' ELSE 'Commercial' END, 'demo', 'demo-monitoring'
FROM (VALUES
('ARR-001','Ararat~','ararat','Ararat',39.851,44.712,48),('GEG-001','Masrik-1 Solar Plant','gegharkunik','Mets Masrik',40.2205,45.7605,55),('ARG-001','Ayg-1 Solar Project','aragatsotn','Talin',40.362,43.915,200),('ARM-001','Armavir~','armavir','Armavir',40.162,44.022,5),('GEG-002','Gegharkunik~','gegharkunik','Martuni',40.152,45.29,4.5),('ARM-002','Margara~','armavir','Margara',39.9992,44.2134,1.5),('SYU-001','Meghri~','syunik','Meghri',38.9137,46.2266,1.5),('KOT-001','Nor Hachn~','kotayk','Nor Hachn',40.3175,44.5383,3),('ARG-002','Dashtadem~','aragatsotn','Dashtadem',40.3533,43.8369,2),('ARM-003','Baghramyan~','armavir','Baghramyan',40.1808,44.4073,10),('GEG-003','Vardenis~','gegharkunik','Vardenis',40.1862,45.7051,1.5),('SYU-002','Kapan~','syunik','Kapan',39.2306,46.375,0.5),('KOT-002','Abovyan~','kotayk','Abovyan',40.2693,44.6399,3),('ARG-003','Ashtarak~','aragatsotn','Ashtarak',40.2949,44.3356,0.8),('ARG-004','Talin~ 2','aragatsotn','Talin',40.4182,43.827,5),('GEG-004','Vardenis~ 2','gegharkunik','Vardenis',40.1422,45.7635,5),('GEG-005','Martuni~ 2','gegharkunik','Martuni',40.1664,45.2753,3),('SHI-001','Gyumri~','shirak','Gyumri',40.8113,43.8113,1),('ARG-005','Aparan~','aragatsotn','Aparan',40.6005,44.3985,4.5),('LOR-001','Stepanavan~','lori','Stepanavan',40.9828,44.3526,5),('SHI-002','Ashotsk~','shirak','Ashotsk',40.99,43.8459,7.5),('LOR-002','Vanadzor~','lori','Vanadzor',40.8467,44.4976,5),('SHI-003','Artik~','shirak','Artik',40.6484,43.9543,5),('VAY-001','Yeghegnadzor~','vayots-dzor','Yeghegnadzor',39.7959,45.3055,5),('SHI-004','Maralik~','shirak','Maralik',40.5589,43.829,10),('ARR-002','Masis~','ararat','Masis',40.06,44.4138,4),('VAY-002','Jermuk~','vayots-dzor','Jermuk',39.8515,45.6526,1),('ARG-006','Aragats~','aragatsotn','Aragats',40.4777,44.3157,5),('LOR-003','Spitak~','lori','Spitak',40.8291,44.223,3),('ARR-003','Vedi~','ararat','Vedi',39.9141,44.7572,12),('KOT-003','Yeghvard~','kotayk','Yeghvard',40.3011,44.5096,5),('ARR-004','Artashat~','ararat','Artashat',39.9674,44.5579,5),('ARR-005','Yeraskh~','ararat','Yeraskh',39.7583,44.9063,1),('ARR-006','Yeraskh~ 2','ararat','Yeraskh',39.7305,44.9537,5),('ARR-007','Ararat~ 2','ararat','Ararat',39.8093,44.6919,4),('ARR-008','Ararat~ 3','ararat','Ararat',39.8644,44.7413,5),('ARM-004','Baghramyan~ 2','armavir','Baghramyan',40.1808,44.3462,4),('TAV-001','Ijevan~','tavush','Ijevan',40.8811,45.1846,1),('GEG-006','Sevan~','gegharkunik','Sevan',40.5764,44.9199,0.5),('ARM-005','Armavir~ 2','armavir','Armavir',40.1906,44.0322,7.5),('GEG-007','Sevan~ 2','gegharkunik','Sevan',40.5519,44.9404,5),('ARM-006','Vagharshapat~','armavir','Vagharshapat',40.1608,44.3172,12),('ARG-007','Aparan~ 2','aragatsotn','Aparan',40.5734,44.3198,12),('LOR-004','Alaverdi~','lori','Alaverdi',41.0964,44.6415,5),('TAV-002','Noyemberyan~','tavush','Noyemberyan',41.1376,45.0318,5),('ARM-007','Metsamor~','armavir','Metsamor',40.1392,44.1182,5),('EVN-001','Erebuni~','yerevan','Erebuni',40.1025,44.5612,10),('GEG-008','Martuni~ 3','gegharkunik','Martuni',40.1464,45.292,10),('SYU-003','Sisian~','syunik','Sisian',39.5395,46.0039,5),('EVN-002','Nubarashen~','yerevan','Nubarashen',40.0862,44.5665,5),('ARM-008','Metsamor~ 2','armavir','Metsamor',40.1152,44.0855,1),('SYU-004','Goris~','syunik','Goris',39.525,46.3701,0.5),('ARR-009','Vedi~ 2','ararat','Vedi',39.8882,44.7013,10),('ARG-008','Katnaghbyur~','aragatsotn','Katnaghbyur',40.3713,43.976,5),('GEG-009','Gavar~','gegharkunik','Gavar',40.3517,45.1422,2),('KOT-004','Hrazdan~','kotayk','Hrazdan',40.5394,44.7509,5),('GEG-010','Chambarak~','gegharkunik','Chambarak',40.5637,45.3114,2),('ARM-009','Armavir~ 3','armavir','Armavir',40.1568,44.0657,5),('ARR-010','Artashat~ 2','ararat','Artashat',39.9919,44.5717,0.8),('ARR-011','Masis~ 2','ararat','Masis',40.068,44.449,0.8),('KOT-005','Abovyan~ 2','kotayk','Abovyan',40.2519,44.6268,5),('ARM-010','Vagharshapat~ 2','armavir','Vagharshapat',40.1795,44.2995,5),('KOT-006','Charentsavan~','kotayk','Charentsavan',40.411,44.6542,2),('VAY-003','Vayk~','vayots-dzor','Vayk',39.7036,45.4525,5),('VAY-004','Areni~','vayots-dzor','Areni',39.7071,45.2484,5),('ARG-009','Talin~ 3','aragatsotn','Talin',40.4074,43.8722,0.8),('TAV-003','Berd~','tavush','Berd',40.8459,45.383,5),('KOT-007','Nor Hachn~ 2','kotayk','Nor Hachn',40.3116,44.5542,12),('KOT-008','Yeghvard~ 2','kotayk','Yeghvard',40.2877,44.5107,10),('GEG-011','Chambarak~ 2','gegharkunik','Chambarak',40.5856,45.318,4)
) AS v(id,name,prov,muni,lat,lng,mw);

-- Publicly reported projects: identity from public information, still unverified; monitoring values are demo.
UPDATE public.stations SET operator = 'FRV (Fotowatio Renewable Ventures)', verification = 'unverified', source_id = 'public-registry' WHERE id = 'AM-GEG-001';
UPDATE public.stations SET verification = 'unverified', source_id = 'public-registry' WHERE id = 'AM-ARG-001';

-- ---------- Seed: demo observation history (monthly passes) ----------
WITH d AS (SELECT ARRAY['2026-05-04','2026-06-04','2026-07-04','2026-08-04','2026-09-04','2026-10-02']::date[] AS ds),
v(id, cs) AS (VALUES
('ARR-001','{90,88,84,81,78,38}'),('GEG-001','{91,92,90,91,89,90}'),('ARG-001','{86,85,83,79,74,68}'),('ARM-001','{84,80,71,62,55,37}'),('GEG-002','{83,81,77,72,66,58}'),('ARM-002','{89,89,89,88,88,88}'),('SYU-001','{84,80,83,84,83,83}'),('KOT-001','{95,94,94,96,92,92}'),('ARG-002','{87,85,84,84,78,77}'),('ARM-003','{88,90,89,90,90,88}'),('GEG-003','{94,90,93,94,94,95}'),('SYU-002','{85,85,82,83,82,82}'),('KOT-002','{90,88,87,83,76,72}'),('ARG-003','{88,83,76,65,52,39}'),('ARG-004','{84,85,86,83,85,87}'),('GEG-004','{86,87,87,87,87,87}'),('GEG-005','{81,82,81,81,81,82}'),('SHI-001','{95,90,80,66,52,32}'),('ARG-005','{89,91,90,91,90,90}'),('LOR-001','{88,89,87,91,91,91}'),('SHI-002','{94,95,93,93,94,91}'),('LOR-002','{91,89,82,78,70,63}'),('SHI-003','{96,97,97,96,98,96}'),('VAY-001','{83,84,81,74,70,66}'),('SHI-004','{90,90,87,84,81,75}'),('ARR-002','{97,99,97,97,96,95}'),('VAY-002','{89,89,87,87,89,90}'),('ARG-006','{95,96,97,95,96,94}'),('LOR-003','{98,99,98,95,96,95}'),('ARR-003','{93,89,89,91,86,87}'),('KOT-003','{92,92,88,83,78,73}'),('ARR-004','{89,88,91,89,90,91}'),('ARR-005','{87,89,85,81,77,72}'),('ARR-006','{88,86,83,76,72,64}'),('ARR-007','{81,79,81,80,83,82}'),('ARR-008','{91,90,90,91,89,87}'),('ARM-004','{83,86,83,82,81,82}'),('TAV-001','{81,81,79,80,81,80}'),('GEG-006','{89,86,82,74,61,51}'),('ARM-005','{80,77,77,79,81,80}'),('GEG-007','{94,91,88,81,73,67}'),('ARM-006','{88,86,86,82,81,76}'),('ARG-007','{91,87,87,86,80,78}'),('LOR-004','{97,92,90,83,74,65}'),('TAV-002','{97,94,95,94,92,93}'),('ARM-007','{92,91,83,79,65,55}'),('EVN-001','{86,85,85,85,84,84}'),('GEG-008','{86,88,87,85}'),('SYU-003','{94,95,94,96,94,94}'),('EVN-002','{91,90,90,91}'),('ARM-008','{87,88,84,78,76,70}'),('SYU-004','{86,85,86,86,86,88}'),('ARR-009','{86,86,79,76,68,58}'),('ARG-008','{86,83,81,74,71,62}'),('GEG-009','{82,86,86,84}'),('KOT-004','{89,83,76,64,50,35}'),('GEG-010','{92,91,89,90,89,90}'),('ARM-009','{80,80,81,80,79,80}'),('ARR-010','{88,88,83,79,74,71}'),('ARR-011','{90,91,90,82,77,73}'),('KOT-005','{91,90,91,88,87,88}'),('ARM-010','{86,85,85,81,79,77}'),('KOT-006','{84,83,85,81,82,82}'),('VAY-003','{97,95,91,86,81,75}'),('VAY-004','{92,88,86,80,75,70}'),('ARG-009','{81,81,84,80,81,80}'),('TAV-003','{86,85,87,84,85,86}'),('KOT-007','{82,82,77,67,57,45}'),('KOT-008','{89,85,79,71,61,52}'),('GEG-011','{84,83,77,68,60,51}')
),
x AS (
  SELECT 'AM-' || v.id AS sid, (SELECT ds FROM d)[i] AS dt, v.cs::int[] AS ca, i,
         abs(hashtext(v.id || i::text)) % 100 AS h
  FROM v, generate_series(1, cardinality(v.cs::int[])) AS i
)
INSERT INTO public.observations (station_id,observed_at,condition_score,f_change,f_anomaly,f_trend,f_quality,quality,cloud_cover,source_id,is_demo)
SELECT sid, dt, ca[i],
  least(100, round(greatest(0, coalesce(ca[i-1], ca[i]) - ca[i]) * 2.2 + (100 - ca[i]) * 0.3))::int,
  least(100, round((100 - ca[i]) * 1.1))::int,
  least(100, round((100 - ca[i]) * 0.9))::int,
  CASE WHEN h < 8 THEN 35 + h * 3 ELSE h % 18 END + 4,
  CASE WHEN h < 8 THEN 'fair' WHEN h % 18 < 15 THEN 'good' ELSE 'fair' END,
  CASE WHEN h < 8 THEN 35 + h * 3 ELSE h % 18 END,
  'sentinel2', true
FROM x;

-- ---------- Seed: problems derived from deterministic rules on the demo history ----------
WITH ranked AS (
  SELECT station_id, observed_at, condition_score,
         row_number() OVER (PARTITION BY station_id ORDER BY observed_at DESC) AS rn
  FROM public.observations
),
s AS (
  SELECT c.station_id AS sid, c.observed_at AS dt, c.condition_score AS cur, p.condition_score AS prev,
         abs(hashtext(c.station_id)) % 100 AS h
  FROM ranked c LEFT JOIN ranked p ON p.station_id = c.station_id AND p.rn = 2
  WHERE c.rn = 1
)
INSERT INTO public.problems (station_id,category,severity,description,confidence,detected_at,affected_pct,action)
SELECT sid, 'data_issue', 'medium', 'No valid observation since ' || dt || '.', 95, dt, NULL::numeric, 'Request new observation / verify data feed'
FROM s WHERE dt < DATE '2026-09-02'
UNION ALL
SELECT sid, 'condition_change', CASE WHEN prev - cur > 25 THEN 'critical' ELSE 'high' END,
  'Condition ' || prev || ' → ' || cur || ' (' || (cur - prev) || ' points) vs previous observation.', 84 + h % 9, dt, NULL::numeric, 'Immediate inspection'
FROM s WHERE dt >= DATE '2026-09-02' AND prev - cur > 15
UNION ALL
SELECT sid, 'area_anomaly', CASE WHEN cur < 40 THEN 'high' ELSE 'medium' END,
  'Potential anomaly detected in ' || (8 + h % 17) || '% of the monitored area.', 76 + h % 11, dt, (8 + h % 17)::numeric, 'Schedule on-site inspection of affected area'
FROM s WHERE dt >= DATE '2026-09-02' AND cur < 60
UNION ALL
SELECT sid, 'vegetation', CASE WHEN cur < 55 THEN 'medium' ELSE 'low' END,
  'Potential vegetation or obstruction along array rows.', 66 + h % 14, dt, (2 + h % 8)::numeric, 'Dispatch vegetation clearing / obstruction check'
FROM s WHERE dt >= DATE '2026-09-02' AND cur < 75 AND (h % 10 < 7 OR sid = 'AM-ARR-001')
UNION ALL
SELECT sid, 'visual_anomaly', 'high',
  'Potential abnormal visual/spectral signal on part of the array.', 70 + h % 12, dt, (4 + h % 9)::numeric, 'Remote imagery review, then field check'
FROM s WHERE dt >= DATE '2026-09-02' AND cur < 50 AND (h % 10 >= 3 OR sid = 'AM-ARR-001');

-- ---------- Seed: alerts generated by the MVP alert rules ----------
WITH ranked AS (
  SELECT station_id, observed_at, condition_score,
         row_number() OVER (PARTITION BY station_id ORDER BY observed_at DESC) AS rn
  FROM public.observations
),
s AS (
  SELECT c.station_id AS sid, c.observed_at AS dt, c.condition_score AS cur, p.condition_score AS prev,
         (SELECT count(*) FROM public.problems pr WHERE pr.station_id = c.station_id) AS np,
         (SELECT count(*) FROM public.problems pr WHERE pr.station_id = c.station_id AND pr.severity IN ('high','critical')) AS nsig,
         (SELECT count(*) FROM public.problems pr WHERE pr.station_id = c.station_id AND pr.severity IN ('high','critical') AND pr.category <> 'condition_change') AS nanom
  FROM ranked c LEFT JOIN ranked p ON p.station_id = c.station_id AND p.rn = 2
  WHERE c.rn = 1
)
INSERT INTO public.alerts (station_id,rule,severity,title,message,condition_from,condition_to,action,created_at)
SELECT sid, 'data_failure', 'medium', 'Data Quality Alert', 'No valid observation within 30 days (last: ' || dt || ').', prev, cur, 'Request new observation / verify data feed', DATE '2026-10-02'
FROM s WHERE dt < DATE '2026-09-02'
UNION ALL
SELECT sid, 'critical_condition', 'critical', 'Critical Alert', 'Condition ' || prev || ' → ' || cur || '. ' || np || ' problems detected.', prev, cur, 'Immediate inspection', dt
FROM s WHERE dt >= DATE '2026-09-02' AND cur < 40
UNION ALL
SELECT sid, 'significant_deterioration', 'high', 'Significant Deterioration', 'Condition decreased by ' || (prev - cur) || ' points since previous observation.', prev, cur, 'Schedule inspection', dt
FROM s WHERE dt >= DATE '2026-09-02' AND prev - cur > 15
UNION ALL
SELECT sid, 'critical_anomaly', 'critical', 'Critical Anomaly', 'High-severity anomaly detected.', prev, cur, 'Immediate inspection', dt
FROM s WHERE dt >= DATE '2026-09-02' AND nanom > 0 AND cur < 40
UNION ALL
SELECT sid, 'multiple_problems', 'high', 'Inspection Alert', np || ' significant problems detected.', prev, cur, 'Prioritize field inspection', dt
FROM s WHERE dt >= DATE '2026-09-02' AND (nsig >= 2 OR (np >= 2 AND cur < 60));