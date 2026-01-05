import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';

/**
 * HELPER SCRIPT TO GET ETSY ACCESS TOKEN
 * This starts a temporary server to handle the OAuth2 redirect.
 */

const app = express();
const port = 3003;

const ETSY_API_KEY = process.env.ETSY_API_KEY;
const REDIRECT_URI = `http://localhost:${port}/callback`;

// Generate PKCE code verifier and challenge
const code_verifier = crypto.randomBytes(32).toString('base64url');
const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');

console.log('--- ETSY AUTH HELPER ---');

if (!ETSY_API_KEY) {
    console.error('❌ Error: ETSY_API_KEY is missing in .env');
    process.exit(1);
}

app.get('/login', (req, res) => {
    const scope = 'listings_r listings_w shops_r'; // Basic scopes for sync
    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = `https://www.etsy.com/oauth/connect?` +
        `response_type=code&` +
        `client_id=${ETSY_API_KEY}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}&` +
        `code_challenge=${code_challenge}&` +
        `code_challenge_method=S256`;

    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const response = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
            grant_type: 'authorization_code',
            client_id: ETSY_API_KEY,
            redirect_uri: REDIRECT_URI,
            code: code,
            code_verifier: code_verifier
        });

        console.log('\n✅ SUCCESS! Copy the following token to your .env file:');
        console.log('----------------------------------------------------');
        console.log(`ETSY_ACCESS_TOKEN=${response.data.access_token}`);
        console.log('----------------------------------------------------\n');

        res.send('<h1>Success!</h1><p>Check your terminal for the ETSY_ACCESS_TOKEN. You can close this tab.</p>');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to exchange code for token:', error.response?.data || error.message);
        res.status(500).send('Authentication failed.');
    }
});

app.listen(port, () => {
    console.log(`\n1. Open this URL in your browser: http://localhost:${port}/login`);
    console.log(`2. Log in to Etsy and click "Allow Access".`);
    console.log(`3. The token will be printed here in the terminal.\n`);
});
