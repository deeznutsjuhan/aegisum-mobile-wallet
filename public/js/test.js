async function testLogin() {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = 'Testing...';
    
    try {
        console.log('Starting login test...');
        
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });
        
        console.log('Response received:', response.status);
        
        const data = await response.json();
        console.log('Data:', data);
        
        if (data.success) {
            resultDiv.innerHTML = '<p style="color: green;">Login successful!</p><p>Token: ' + data.data.token.substring(0, 20) + '...</p>';
        } else {
            resultDiv.innerHTML = '<p style="color: red;">Login failed: ' + data.message + '</p>';
        }
    } catch (error) {
        console.error('Error:', error);
        resultDiv.innerHTML = '<p style="color: red;">Error: ' + error.message + '</p>';
    }
}