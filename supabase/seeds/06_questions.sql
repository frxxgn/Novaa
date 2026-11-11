-- =============================================================================
-- NOVALIUS · Contenido inicial · Banco de preguntas de Novalius Challenge
-- El índice correcto se guarda solo en servidor; el orden de las opciones se
-- baraja en cada partida.
-- =============================================================================

insert into public.game_questions (category, difficulty, question, options, correct_index, explanation) values
-- Tecnología
('tecnologia', 1, '¿Qué significan las siglas «CPU»?', '["Unidad central de procesamiento", "Unidad de control personal", "Centro de procesos unificados", "Circuito de potencia universal"]', 0, 'CPU viene del inglés Central Processing Unit.'),
('tecnologia', 1, '¿Qué empresa desarrolla el sistema operativo Android?', '["Apple", "Google", "Microsoft", "Samsung"]', 1, 'Google lidera el desarrollo de Android.'),
('tecnologia', 1, '¿Cuál de estas unidades representa más información?', '["1 gigabyte", "1 megabyte", "1 terabyte", "1 kilobyte"]', 2, 'Un terabyte equivale a unos mil gigabytes.'),
('tecnologia', 1, '¿Qué dispositivo se usa para mover el puntero en la pantalla?', '["Escáner", "Altavoz", "Router", "Ratón"]', 3, ''),
('tecnologia', 2, '¿Cuántos bits forman un byte?', '["8", "4", "16", "10"]', 0, ''),
('tecnologia', 2, '¿En qué año se presentó el primer iPhone?', '["2005", "2007", "2009", "2010"]', 1, 'Steve Jobs lo presentó en enero de 2007.'),
('tecnologia', 2, '¿Qué lenguaje se usa para dar estilo visual a las páginas web?', '["SQL", "Python", "CSS", "C"]', 2, ''),
('tecnologia', 2, '¿Qué componente guarda datos temporalmente mientras el ordenador está encendido?', '["Disco duro", "Fuente de alimentación", "Tarjeta de red", "Memoria RAM"]', 3, ''),
('tecnologia', 2, '¿Qué significan las siglas «IA»?', '["Inteligencia artificial", "Interfaz automática", "Información avanzada", "Integración algorítmica"]', 0, ''),
('tecnologia', 3, '¿Quién es considerada la primera programadora de la historia?', '["Grace Hopper", "Ada Lovelace", "Marie Curie", "Hedy Lamarr"]', 1, 'Ada Lovelace escribió un algoritmo para la máquina analítica de Babbage.'),
('tecnologia', 3, '¿Qué número decimal representa el binario 1010?', '["12", "8", "10", "5"]', 2, '8 + 2 = 10.'),
('tecnologia', 3, '¿Qué protocolo se usa para enviar correo electrónico entre servidores?', '["FTP", "HTTP", "SSH", "SMTP"]', 3, ''),

-- Cultura general
('cultura', 1, '¿Quién escribió «Don Quijote de la Mancha»?', '["Miguel de Cervantes", "Lope de Vega", "Federico García Lorca", "Francisco de Quevedo"]', 0, ''),
('cultura', 1, '¿Cuál es la capital de Italia?', '["Milán", "Roma", "Venecia", "Florencia"]', 1, ''),
('cultura', 1, '¿En qué país se encuentran las pirámides de Guiza?', '["México", "Perú", "Egipto", "Sudán"]', 2, ''),
('cultura', 1, '¿En qué ciudad se encuentra la Alhambra?', '["Córdoba", "Sevilla", "Toledo", "Granada"]', 3, ''),
('cultura', 2, '¿Quién pintó «Las meninas»?', '["Diego Velázquez", "Francisco de Goya", "El Greco", "Pablo Picasso"]', 0, ''),
('cultura', 2, '¿En qué año llegó Cristóbal Colón a América?', '["1512", "1492", "1453", "1500"]', 1, ''),
('cultura', 2, '¿Cuál es el río más largo de la península ibérica?', '["Ebro", "Duero", "Tajo", "Guadalquivir"]', 2, 'El Tajo recorre algo más de 1.000 km.'),
('cultura', 2, '¿Qué instrumento tocaba principalmente Paco de Lucía?', '["Piano", "Violín", "Cajón", "Guitarra"]', 3, ''),
('cultura', 2, '¿Qué escritor creó a Sherlock Holmes?', '["Arthur Conan Doyle", "Agatha Christie", "Edgar Allan Poe", "Charles Dickens"]', 0, ''),
('cultura', 2, '¿Qué arquitecto diseñó la Sagrada Familia?', '["Santiago Calatrava", "Antoni Gaudí", "Rafael Moneo", "Lluís Domènech i Montaner"]', 1, ''),
('cultura', 2, '¿Qué lengua tiene más hablantes nativos en el mundo?', '["Inglés", "Español", "Chino mandarín", "Hindi"]', 2, ''),
('cultura', 3, '¿En qué año cayó el Muro de Berlín?', '["1991", "1985", "1979", "1989"]', 3, ''),
('cultura', 3, '¿Cuál de estos países NO tiene salida al mar?', '["Bolivia", "Chile", "Perú", "Uruguay"]', 0, ''),
('cultura', 3, '¿Quién compuso «Las cuatro estaciones»?', '["Wolfgang Amadeus Mozart", "Antonio Vivaldi", "Johann Sebastian Bach", "Ludwig van Beethoven"]', 1, ''),

-- Lógica
('logica', 1, 'Si hoy es lunes, ¿qué día será dentro de tres días?', '["Jueves", "Miércoles", "Viernes", "Martes"]', 0, ''),
('logica', 1, '¿Qué número continúa la serie 2, 4, 6, 8…?', '["12", "10", "9", "16"]', 1, ''),
('logica', 1, '¿Cuántos lados tiene un hexágono?', '["5", "7", "6", "8"]', 2, ''),
('logica', 2, '¿Qué número continúa la serie 1, 1, 2, 3, 5, 8…?', '["11", "12", "15", "13"]', 3, 'Cada número es la suma de los dos anteriores.'),
('logica', 2, 'Si 3 máquinas fabrican 3 piezas en 3 minutos, ¿cuánto tardan 100 máquinas en fabricar 100 piezas?', '["3 minutos", "100 minutos", "33 minutos", "1 minuto"]', 0, 'Cada máquina fabrica una pieza en 3 minutos.'),
('logica', 2, '¿Qué número continúa la serie 3, 9, 27…?', '["54", "81", "36", "63"]', 1, 'Se multiplica por 3.'),
('logica', 2, 'Si todos los A son B y todos los B son C, entonces…', '["Todos los C son A", "Ningún A es C", "Todos los A son C", "Algunos C no son B"]', 2, ''),
('logica', 2, 'Ana es más alta que Luis y Luis es más alto que Marta. ¿Quién es la persona más baja?', '["Ana", "Luis", "No se puede saber", "Marta"]', 3, ''),
('logica', 3, 'Un bate y una pelota cuestan 1,10 € en total. El bate cuesta 1 € más que la pelota. ¿Cuánto cuesta la pelota?', '["0,05 €", "0,10 €", "0,15 €", "0,01 €"]', 0, 'Pelota 0,05 € y bate 1,05 €.'),
('logica', 3, 'Un nenúfar duplica su tamaño cada día y cubre un lago en 48 días. ¿En cuántos días cubre la mitad?', '["24", "47", "46", "36"]', 1, 'El día anterior a cubrirlo entero.'),
('logica', 3, '¿Qué número falta? 2, 6, 12, 20, 30, …', '["40", "36", "42", "44"]', 2, 'Las diferencias crecen de 2 en 2: 4, 6, 8, 10, 12.'),
('logica', 3, 'A las 3:15, ¿qué ángulo forman las agujas de un reloj analógico?', '["0 grados", "15 grados", "90 grados", "7,5 grados"]', 3, 'La aguja horaria ya ha avanzado un cuarto de hora: 7,5 grados.'),

-- Ciencia
('ciencia', 1, '¿Cuál es el planeta más grande del sistema solar?', '["Júpiter", "Saturno", "Neptuno", "Tierra"]', 0, ''),
('ciencia', 1, '¿Qué gas absorben las plantas durante la fotosíntesis?', '["Oxígeno", "Dióxido de carbono", "Nitrógeno", "Helio"]', 1, ''),
('ciencia', 1, '¿Qué planeta es conocido como el planeta rojo?', '["Venus", "Mercurio", "Marte", "Júpiter"]', 2, ''),
('ciencia', 1, '¿Qué órgano bombea la sangre por el cuerpo?', '["Hígado", "Pulmón", "Riñón", "Corazón"]', 3, ''),
('ciencia', 1, '¿Quién formuló la teoría de la relatividad?', '["Albert Einstein", "Isaac Newton", "Niels Bohr", "Galileo Galilei"]', 0, ''),
('ciencia', 2, '¿Cuántos huesos tiene aproximadamente el cuerpo humano adulto?', '["150", "206", "312", "180"]', 1, ''),
('ciencia', 2, '¿A qué temperatura hierve el agua al nivel del mar?', '["90 °C", "120 °C", "100 °C", "80 °C"]', 2, ''),
('ciencia', 2, '¿Cuál es el símbolo químico del oro?', '["Ag", "Or", "Go", "Au"]', 3, 'Au procede del latín aurum.'),
('ciencia', 2, '¿Qué partícula subatómica tiene carga negativa?', '["Electrón", "Protón", "Neutrón", "Fotón"]', 0, ''),
('ciencia', 3, '¿Cuál es la velocidad aproximada de la luz en el vacío?', '["30.000 km/s", "300.000 km/s", "3.000 km/s", "3.000.000 km/s"]', 1, ''),
('ciencia', 3, '¿Cuál es el elemento más abundante del universo?', '["Helio", "Oxígeno", "Hidrógeno", "Carbono"]', 2, ''),
('ciencia', 3, '¿Cuántos cromosomas tiene una célula humana típica?', '["23", "44", "48", "46"]', 3, '23 pares.'),
('ciencia', 3, '¿Cuál es la fórmula química del agua?', '["H₂O", "HO₂", "H₂O₂", "OH"]', 0, ''),

-- Internet
('internet', 1, '¿Qué significa «www» en una dirección web?', '["World Wide Web", "World Web Wide", "Wide World Web", "Web World Wide"]', 0, ''),
('internet', 1, '¿Qué indica el candado junto a la dirección de una web?', '["Que la web es del Gobierno", "Que la conexión está cifrada (HTTPS)", "Que no tiene anuncios", "Que la página está en caché"]', 1, ''),
('internet', 1, '¿Qué es un navegador web?', '["Un cable de red", "Un buscador de archivos del ordenador", "Un programa para visitar páginas web", "Una red social"]', 2, ''),
('internet', 2, '¿Quién propuso la World Wide Web en 1989?', '["Bill Gates", "Steve Jobs", "Vint Cerf", "Tim Berners-Lee"]', 3, ''),
('internet', 2, '¿Qué significan las siglas «URL»?', '["Localizador uniforme de recursos", "Red universal de enlaces", "Registro único de lenguaje", "Línea de recursos unificada"]', 0, 'Uniform Resource Locator.'),
('internet', 2, '¿Qué es el «phishing»?', '["Un tipo de copia de seguridad", "Suplantar a alguien para robar datos", "Un formato de imagen", "Un lenguaje de programación"]', 1, ''),
('internet', 2, '¿Qué código de estado HTTP indica que una página no existe?', '["200", "301", "404", "500"]', 2, ''),
('internet', 2, '¿Qué red social nació en 2010 para compartir fotos con filtros?', '["Facebook", "Twitter", "Pinterest", "Instagram"]', 3, ''),
('internet', 2, 'En una dirección como «novalius.es», ¿qué es «.es»?', '["Un dominio de nivel superior", "Un servidor de correo", "Un protocolo de seguridad", "Un lenguaje web"]', 0, ''),
('internet', 3, '¿Qué significa «SEO»?', '["Servicio de envío online", "Optimización para motores de búsqueda", "Sistema de edición web", "Seguridad en operaciones"]', 1, 'Search Engine Optimization.'),
('internet', 3, '¿En qué año se fundó Google?', '["1994", "2001", "1998", "2004"]', 2, ''),
('internet', 3, '¿Qué sistema traduce nombres de dominio en direcciones IP?', '["VPN", "CSS", "USB", "DNS"]', 3, ''),

-- Curiosidades
('curiosidades', 1, '¿Cuántas patas tiene una araña?', '["8", "6", "10", "12"]', 0, ''),
('curiosidades', 1, '¿Cuántos días tiene un año bisiesto?', '["365", "366", "364", "367"]', 1, ''),
('curiosidades', 1, '¿Qué pesa más, un kilo de plomo o un kilo de plumas?', '["El plomo", "Las plumas", "Pesan lo mismo", "Depende de la altura"]', 2, ''),
('curiosidades', 1, '¿Cuál es el océano más grande?', '["Atlántico", "Índico", "Ártico", "Pacífico"]', 3, ''),
('curiosidades', 2, '¿Cuál es el animal terrestre más rápido?', '["Guepardo", "León", "Caballo", "Gacela"]', 0, ''),
('curiosidades', 2, '¿Cuántos corazones tiene un pulpo?', '["1", "3", "2", "4"]', 1, ''),
('curiosidades', 2, '¿De qué color es la sangre de los pulpos?', '["Roja", "Verde", "Azul", "Transparente"]', 2, 'Por la hemocianina, que contiene cobre.'),
('curiosidades', 2, '¿Cuál es el único mamífero capaz de volar de forma activa?', '["La ardilla voladora", "El colugo", "El petauro", "El murciélago"]', 3, ''),
('curiosidades', 2, '¿Cuál es el hueso más largo del cuerpo humano?', '["Fémur", "Tibia", "Húmero", "Peroné"]', 0, ''),
('curiosidades', 3, '¿Qué fruta lleva sus semillas en el exterior?', '["Kiwi", "Fresa", "Higo", "Pitaya"]', 1, ''),
('curiosidades', 3, '¿Qué país abarca más husos horarios contando sus territorios de ultramar?', '["Rusia", "Estados Unidos", "Francia", "China"]', 2, ''),
('curiosidades', 3, '¿Qué animal es el mamífero más grande del planeta?', '["Elefante africano", "Cachalote", "Tiburón ballena", "Ballena azul"]', 3, 'El tiburón ballena es un pez, no un mamífero.'),

-- Creatividad
('creatividad', 1, '¿Qué color se obtiene al mezclar pintura azul y amarilla?', '["Verde", "Morado", "Naranja", "Marrón"]', 0, ''),
('creatividad', 1, '¿Qué color se obtiene al mezclar pintura roja y azul?', '["Verde", "Morado", "Naranja", "Gris"]', 1, ''),
('creatividad', 1, '¿Cuáles son los colores primarios de la luz en el modelo RGB?', '["Rojo, amarillo y azul", "Cian, magenta y amarillo", "Rojo, verde y azul", "Blanco, negro y gris"]', 2, ''),
('creatividad', 2, '¿Qué es el «kerning» en tipografía?', '["El grosor de una fuente", "La altura de las mayúsculas", "El color del texto", "El espacio entre pares de letras"]', 3, ''),
('creatividad', 2, '¿Con qué movimiento artístico se asocia a Salvador Dalí?', '["Surrealismo", "Cubismo", "Impresionismo", "Barroco"]', 0, ''),
('creatividad', 2, '¿Cuál de estos formatos de imagen admite fondo transparente?', '["JPEG", "PNG", "MP4", "DOCX"]', 1, ''),
('creatividad', 2, '¿Quién pintó «La noche estrellada»?', '["Claude Monet", "Pablo Picasso", "Vincent van Gogh", "Edvard Munch"]', 2, ''),
('creatividad', 2, '¿Qué significa «UX» en diseño digital?', '["Unidad de exportación", "Usabilidad extrema", "Ultra extensión", "Experiencia de usuario"]', 3, 'User Experience.'),
('creatividad', 2, '¿Qué técnica de animación fotografía objetos moviéndolos poco a poco?', '["Stop motion", "Rotoscopia", "Morphing", "Captura de movimiento"]', 0, ''),
('creatividad', 3, '¿Qué es la «regla de los tercios» en fotografía?', '["Usar solo tres colores", "Componer con una cuadrícula de 3 × 3", "Hacer tres fotos de cada escena", "Exponer tres veces la imagen"]', 1, ''),
('creatividad', 3, '¿Cómo se llaman las fuentes con pequeños remates en los extremos de las letras?', '["Sans serif", "Monoespaciadas", "Serif", "Script"]', 2, ''),
('creatividad', 3, 'En el círculo cromático tradicional, ¿cuál es el complementario del azul?', '["Verde", "Rojo", "Violeta", "Naranja"]', 3, '');
