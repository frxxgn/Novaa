-- =============================================================================
-- NOVALIUS · 0006 · Datos de referencia: roles y permisos (mínimo privilegio)
-- =============================================================================

insert into public.roles (key, name, description, rank) values
  ('user',     'Usuario registrado', 'Cuenta personal: presupuestos guardados, juegos y cupones.', 10),
  ('customer', 'Cliente',            'Acceso al portal privado con sus proyectos.', 20),
  ('team',     'Equipo',             'Miembro del equipo de Novalius con permisos configurables.', 30),
  ('admin',    'Administrador',      'Control total de la plataforma.', 40)
on conflict (key) do nothing;

insert into public.permissions (key, "group", description) values
  ('dashboard.view',          'Panel',          'Ver el dashboard del panel'),
  ('content.manage',          'Contenido',      'Crear y editar páginas, secciones, servicios, proyectos, plantillas, FAQ, medios, navegación y traducciones'),
  ('content.publish',         'Contenido',      'Publicar y despublicar páginas'),
  ('design.manage',           'Diseño',         'Editar y publicar el diseño global y las animaciones'),
  ('nova.manage',             'Nova',           'Editar configuración, instrucciones y conocimiento de Nova'),
  ('nova.conversations.read', 'Nova',           'Consultar conversaciones de Nova'),
  ('pricing.manage',          'Tarifas',        'Editar reglas de presupuestos y referencias de mercado'),
  ('crm.read',                'CRM',            'Consultar leads y presupuestos'),
  ('crm.write',               'CRM',            'Editar leads, notas y estados'),
  ('crm.export',              'CRM',            'Exportar leads'),
  ('customers.manage',        'Clientes',       'Gestionar clientes y su acceso al portal'),
  ('projects.manage',         'Proyectos',      'Gestionar proyectos, fases, tareas y archivos de clientes'),
  ('games.manage',            'Challenge',      'Gestionar preguntas, reglas y estadísticas del Challenge'),
  ('coupons.manage',          'Challenge',      'Validar, canjear y revocar cupones'),
  ('users.manage',            'Usuarios',       'Invitar usuarios, asignar roles y gestionar solicitudes de privacidad'),
  ('notifications.manage',    'Notificaciones', 'Configurar canales y consultar entregas'),
  ('analytics.read',          'Analíticas',     'Consultar analíticas'),
  ('settings.manage',         'Configuración',  'Editar la configuración global'),
  ('audit.read',              'Seguridad',      'Consultar el registro de auditoría')
on conflict (key) do nothing;

-- El rol admin tiene todos los permisos de forma implícita (has_permission).
-- Equipo: operación diaria sin configuración crítica (tarifas, usuarios, ajustes).
insert into public.role_permissions (role, permission) values
  ('team', 'dashboard.view'),
  ('team', 'content.manage'),
  ('team', 'crm.read'),
  ('team', 'crm.write'),
  ('team', 'customers.manage'),
  ('team', 'projects.manage'),
  ('team', 'nova.conversations.read'),
  ('team', 'coupons.manage'),
  ('team', 'analytics.read')
on conflict do nothing;
