// backend/src/supabaseClient.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Ensure URL is always defined and use consistent naming
const supabaseUrl = process.env.SUPABASE_URL || 'https://tnklgwbqvqqisfujoack.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl) {
  console.error('Supabase URL missing');
  throw new Error('Missing Supabase URL. Check your .env file.');
}

if (!supabaseKey) {
  console.error('Supabase key missing');
  throw new Error('Missing Supabase key. Check your .env file.');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };