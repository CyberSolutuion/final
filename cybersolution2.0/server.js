require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
const port = 3000;
app.use(express.static('public'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.redirect('/cadastro.html');
});

// Rota para a página de cadastro
app.get('/cadastro.html', (req, res) => {
    res.sendFile(__dirname + '/public/cadastro.html'); 
});

// Rota para a página de login
app.get('/login.html', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Verifica se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseKey) {
    console.error('As variáveis SUPABASE_URL e SUPABASE_KEY não estão definidas.');
    process.exit(1);
}

app.use(bodyParser.json());

// Configuração do Multer para lidar com uploads de arquivos
const upload = multer({ storage: multer.memoryStorage() });

// Cadastro de usuário
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    console.log('Dados recebidos no servidor:', { username, email, password });

    const { data, error } = await supabase
        .from('users')
        .insert([{ username, email, password }]);

    if (error) return res.status(400).json({ error: 'Usuario ou E-mail Duplicado' });
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
});

// Login de usuário
app.post('/login', async (req, res) => {
    const { user, password } = req.body;

    const { data, error } = await supabase
        .from('users')
        .select('id, username')  // Seleciona apenas os campos necessários
        .eq('username', user)
        .eq('password', password)
        .single();

    console.log("Data:", data, "Error:", error);

    if (error || !data) {
        return res.status(400).json({ error: 'Usuário ou senha incorretos' });
    }

    // Ajuste o campo para 'username' se for o nome de usuário, em vez de 'name'
    res.json({ message: 'Login realizado com sucesso!', user: { id: data.id, name: data.username } });
});

// Publicação de colaborações com upload de arquivos
app.post('/publication', upload.single('file'), async (req, res) => {
    const { user_id, category, description } = req.body;
    const file = req.file;

    try {
        // Carrega o arquivo no Supabase Storage
        const uploadPath = `publications/${file.originalname}`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from('uploads')
            .upload(uploadPath, file.buffer, {
                cacheControl: '3600',
                upsert: false,
            });

        if (storageError) throw storageError;

        // Obtém a URL pública do arquivo armazenado usando o path de `uploadPath`
        const { data: urlData, error: urlError } = await supabase.storage
            .from('uploads')
            .getPublicUrl(uploadPath);

        if (urlError) throw urlError;

        // Insere a publicação no banco de dados com a URL pública
        const { data: publicationData, error: publicationError } = await supabase
            .from('publications')
            .insert([{ 
                user_id, 
                category, 
                description, 
                file_path: urlData.publicUrl // Insere a URL pública
            }]);

        if (publicationError) throw publicationError;

        res.status(201).json({ message: 'Colaboração publicada com sucesso!', publication: publicationData });
    } catch (error) {
        console.error("Erro ao publicar:", error);
        res.status(400).json({ error: error.message });
    }
});

// Obter publicações
app.get('/publications', async (req, res) => {
    const { data, error } = await supabase
        .from('publications')
        .select('*, users(username)')
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
