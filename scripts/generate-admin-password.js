#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🔐 Aegisum Admin Password Generator\n');

rl.question('Enter admin password: ', async (password) => {
    if (password.length < 8) {
        console.log('❌ Password must be at least 8 characters long');
        rl.close();
        return;
    }

    try {
        const hash = await bcrypt.hash(password, 12);
        console.log('\n✅ Password hash generated successfully!');
        console.log('\nAdd this to your .env file:');
        console.log(`ADMIN_PASSWORD=${hash}`);
        console.log('\n⚠️  Keep this hash secure and never share it!');
    } catch (error) {
        console.log('❌ Error generating password hash:', error.message);
    }
    
    rl.close();
});