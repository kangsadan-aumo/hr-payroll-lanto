const axios = require('axios');

async function test() {
    try {
        console.log('Testing /api/claims...');
        const resClaims = await axios.get('http://localhost:5000/api/claims');
        console.log('✅ /api/claims responded with status:', resClaims.status);

        console.log('Testing /api/analytics/cost-summary...');
        const resAnalytics = await axios.get('http://localhost:5000/api/analytics/cost-summary');
        console.log('✅ /api/analytics/cost-summary responded with status:', resAnalytics.status);

        console.log('Testing /api/employees...');
        const resEmp = await axios.get('http://localhost:5000/api/employees');
        console.log('✅ /api/employees responded with status:', resEmp.status);

        process.exit(0);
    } catch (err) {
        console.error('❌ API Test Failed:', err.message);
        if (err.response) {
            console.error('Response status:', err.response.status);
            console.error('Response data:', err.response.data);
        }
        process.exit(1);
    }
}

test();
