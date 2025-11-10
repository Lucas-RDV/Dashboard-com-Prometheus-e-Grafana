SELECT setseed(0.42);

BEGIN;

CREATE TABLE IF NOT EXISTS checkins (
  id         BIGSERIAL PRIMARY KEY,
  pessoa     TEXT        NOT NULL,
  curso      TEXT        NOT NULL,
  semestre   INT         NOT NULL CHECK (semestre BETWEEN 1 AND 8),
  sala       TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkins_criado_em ON checkins (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_sala      ON checkins (sala);
CREATE INDEX IF NOT EXISTS idx_checkins_curso     ON checkins (curso);
CREATE INDEX IF NOT EXISTS idx_checkins_semestre  ON checkins (semestre);

INSERT INTO checkins (pessoa, curso, semestre, sala, criado_em)
SELECT
  'Pessoa ' || (1 + (random() * 500)::INT),
  (ARRAY['Sistemas de Informação','Engenharia','Administração','Direito','Medicina','Arquitetura'])
    [1 + FLOOR(random() * 6)::INT],
  1 + FLOOR(random() * 8)::INT,
  (ARRAY['Lab A','Lab B','Sala 101','Sala 202','Maker','Biblioteca'])
    [1 + FLOOR(random() * 6)::INT],
  (NOW() - (FLOOR(random() * 30)::INT || ' days')::interval)
    + (FLOOR(random()*24)::INT || ' hours')::interval
    + (FLOOR(random()*60)::INT || ' minutes')::interval
    + (FLOOR(random()*60)::INT || ' seconds')::interval
FROM generate_series(1, 400);

INSERT INTO checkins (pessoa, curso, semestre, sala, criado_em)
SELECT
  'Pessoa ' || (1 + (random() * 200)::INT),
  (ARRAY['Sistemas de Informação','Engenharia','Administração','Direito','Medicina','Arquitetura'])
    [1 + FLOOR(random() * 6)::INT],
  1 + FLOOR(random() * 8)::INT,
  (ARRAY['Lab A','Lab B','Sala 101','Sala 202','Maker','Biblioteca'])
    [1 + FLOOR(random() * 6)::INT],
  NOW()
    - (FLOOR(random()*24)::INT || ' hours')::interval
    - (FLOOR(random()*60)::INT || ' minutes')::interval
FROM generate_series(1, 50);

COMMIT;
