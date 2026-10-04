-- Configuração editável pelo administrador para imagens dos VIPs e conteúdo das tarefas.
-- Os valores ficam na tabela pública de definições e podem ser alterados pela área Administração > Definições.

INSERT INTO public.site_settings (key, value)
SELECT 'plan_' || n || '_image_url',
       CASE n
         WHEN 1 THEN '/__l5e/assets-v1/4fca6078-046a-4c88-a325-28a1fe6a0137/blue-moon-mark-1.jpg'
         WHEN 2 THEN '/__l5e/assets-v1/9a2c8f32-20a2-42df-9f48-e78867ae12aa/blue-moon-mark-2.jpeg'
         WHEN 3 THEN '/__l5e/assets-v1/bc8c703e-7ad7-4848-8335-c10932c01585/blue-moon-pathfinder.jpeg'
         WHEN 4 THEN '/__l5e/assets-v1/a4f987a8-79e9-4fd2-9f74-9da8708d7d0f/new-glenn.jpeg'
         WHEN 5 THEN '/__l5e/assets-v1/a615d874-bf92-4132-8ac7-ed45eb437e7a/blue-ring.jpg'
         WHEN 6 THEN '/__l5e/assets-v1/94d21066-9d73-4d59-8f62-6ff5b650da61/new-shepard-crew.jpeg'
         WHEN 7 THEN '/__l5e/assets-v1/135e4ea7-c421-4f13-9ba3-f3138b721841/new-shepard-booster.jpeg'
         WHEN 8 THEN '/__l5e/assets-v1/1f81782e-0970-4e71-bda2-7d1ae073299d/new-shepard-capsule.jpg'
         WHEN 9 THEN '/__l5e/assets-v1/cb02dff5-41d5-4add-9140-a570fa4433d5/orbital-factory.jpg'
         WHEN 10 THEN '/__l5e/assets-v1/a615d874-bf92-4132-8ac7-ed45eb437e7a/blue-ring.jpg'
         WHEN 11 THEN '/__l5e/assets-v1/a4f987a8-79e9-4fd2-9f74-9da8708d7d0f/new-glenn.jpeg'
       END
FROM generate_series(1, 11) AS n
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value)
SELECT 'task_' || n || '_image_url', ''
FROM generate_series(1, 5) AS n
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value)
SELECT 'task_' || n || '_video_url', ''
FROM generate_series(1, 5) AS n
ON CONFLICT (key) DO NOTHING;

UPDATE public.plans
SET name = 'VIP ' || id
WHERE id BETWEEN 1 AND 11;


-- Configuração da nova experiência de recarga BLUE ORIGIN.
INSERT INTO public.site_settings (key, value) VALUES
  ('recharge_min_amount', '200'),
  ('recharge_quick_amounts', '900,3000,10200,30000,200000,500000,1000000,2000000,5000000'),
  ('welcome_title', 'Bem-vindo à BLUE ORIGIN'),
  ('welcome_message', 'Bem-vindo à BLUE ORIGIN. Somos uma plataforma digital de longo prazo, criada para oferecer uma experiência simples, transparente e organizada. Acompanhe as atividades, consulte os seus VIPs e utilize os canais oficiais da plataforma para receber novidades e suporte.'),
  ('welcome_icon_url', '')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
