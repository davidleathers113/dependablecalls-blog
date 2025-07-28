import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function updatePiecesMCP() {
  const configPath = path.join(homedir(), '.claude.json');
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('\n🧩 Pieces MCP Configuration Update');
    console.log('==================================');
    console.log('\nTo find your MCP URL:');
    console.log('1. Open Pieces Desktop App');
    console.log('2. Click Settings (gear icon) in bottom-left');
    console.log('3. Navigate to "Model Context Protocol (MCP)"');
    console.log('4. Copy the Server URL from that section\n');
    
    const url = await question('Enter the Pieces MCP Server URL: ');
    
    if (!url) {
      console.log('❌ No URL provided. Exiting without changes.');
      rl.close();
      return;
    }
    
    // Update Pieces configuration
    if (!config.mcpServers) config.mcpServers = {};
    
    config.mcpServers.Pieces = {
      type: "sse",  // Pieces uses Server-Sent Events
      url: url.trim()
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('\n✅ Pieces MCP configuration updated successfully!');
    console.log('🔄 Please restart Claude for the changes to take effect.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

updatePiecesMCP();