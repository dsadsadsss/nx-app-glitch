const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

// For Glitch, we need to use the assigned port from environment variables
const port = process.env.PORT || 3000;

// URL to download nx-app binary
const nxAppUrl = 'https://github.com/dsadsadsss/plutonodes/releases/download/xr/linux-amd64-nx-app';
const nxAppPath = path.join(__dirname, 'nx-app');

// Function to download nx-app binary
function downloadNxApp() {
  return new Promise((resolve, reject) => {
    // Check if nx-app already exists
    if (fs.existsSync(nxAppPath)) {
      console.log('nx-app binary already exists. Skipping download.');
      return resolve();
    }

    console.log('Downloading nx-app binary...');
    const file = fs.createWriteStream(nxAppPath);
    
    const request = https.get(nxAppUrl, (response) => {
      // Handle redirects (HTTP 302, 301, etc.)
      if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`Following redirect to: response.headers.location`);
        
        // Close the initial request
        if (file) {
          file.close();
        }
        
        // Create a new request to the redirect location
        const redirectUrl = new URL(response.headers.location);
        const protocol = redirectUrl.protocol === 'https:' ? https : require('http');
        
        console.log(`Starting download from redirect URL`);
        
        const redirectRequest = protocol.get(redirectUrl.href, (redirectResponse) => {
          if (redirectResponse.statusCode !== 200) {
            reject(new Error(`Failed to download nx-app from redirect. Status code: ${redirectResponse.statusCode}`));
            return;
          }
          
          const newFile = fs.createWriteStream(nxAppPath);
          redirectResponse.pipe(newFile);
          
          newFile.on('finish', () => {
            newFile.close();
            console.log('nx-app binary downloaded successfully via redirect.');
            resolve();
          });
          
          newFile.on('error', (err) => {
            fs.unlink(nxAppPath, () => {});
            reject(err);
          });
        });
        
        redirectRequest.on('error', (err) => {
          fs.unlink(nxAppPath, () => {});
          reject(new Error(`Redirect request failed: ${err.message}`));
        });
        
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download nx-app. Status code: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('nx-app binary downloaded successfully.');
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(nxAppPath, () => {});
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(nxAppPath, () => {});
      reject(new Error(`Download request failed: ${err.message}`));
    });
    
    request.setTimeout(30000, () => {
      request.abort();
      fs.unlink(nxAppPath, () => {});
      reject(new Error('Download request timed out after 30 seconds'));
    });
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Hello World\n');
});

// Download nx-app, then start server and nx-app
downloadNxApp()
  .then(() => {
    // Start the server
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
      
      // Launch nx-app binary without sudo (try direct execution first)
      console.log('Attempting to start nx-app...');
      // First make it executable
      exec(`chmod +x ${nxAppPath}`, (chmodError) => {
        if (chmodError) {
          console.error(`Error making nx-app executable: ${chmodError}`);
          return;
        }
        
        console.log('Successfully made nx-app executable. Starting nx-app...');
        // Then execute it, but don't display its logs
        const nxApp = exec(nxAppPath, (error) => {
          if (error) {
            console.error(`Error executing nx-app: ${error}`);
            return;
          }
          console.log('nx-app is running in the background.');
        });
        
        // Suppress logging of nx-app output
        nxApp.stdout.on('data', () => {});
        nxApp.stderr.on('data', () => {});
        
        nxApp.on('close', (code) => {
          console.log(`nx-app process exited with code ${code}`);
        });
      });
    });
    
    console.log('Server started. Press Ctrl+C to stop.');
  })
  .catch(err => {
    console.error('Error during setup:', err);
    process.exit(1);
  });