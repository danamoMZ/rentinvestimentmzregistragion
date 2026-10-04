-- BLUE ORIGIN: nova experiência de recarga e anúncio de boas-vindas.
INSERT INTO public.site_settings (key, value) VALUES
  ('recharge_min_amount', '200'),
  ('recharge_quick_amounts', '900,3000,10200,30000,200000,500000,1000000,2000000,5000000'),
  ('welcome_title', 'Bem-vindo à BLUE ORIGIN'),
  ('welcome_message', 'Bem-vindo à BLUE ORIGIN. Somos uma plataforma digital de longo prazo, criada para oferecer uma experiência simples, transparente e organizada. Acompanhe as atividades, consulte os seus VIPs e utilize os canais oficiais da plataforma para receber novidades e suporte.'),
  ('welcome_icon_url', '')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
