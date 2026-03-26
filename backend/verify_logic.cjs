// Verification script for PIT and SSO logic
function calculateSSO(baseSalary) {
    const ceiling = 15000;
    const rate = 0.05;
    return Math.min(Math.floor(baseSalary * rate), 750);
}

function calculateIncomeTax(annualTaxableIncome) {
    if (annualTaxableIncome <= 150000) return 0;
    
    let tax = 0;
    const tiers = [
        { limit: 150000, rate: 0 },
        { limit: 300000, rate: 0.05 },
        { limit: 500000, rate: 0.10 },
        { limit: 750000, rate: 0.15 },
        { limit: 1000000, rate: 0.20 },
        { limit: 2000000, rate: 0.25 },
        { limit: 5000000, rate: 0.30 },
        { limit: Infinity, rate: 0.35 }
    ];

    let remainingIncome = annualTaxableIncome;
    let previousLimit = 0;

    for (const tier of tiers) {
        const incomeInTier = Math.min(remainingIncome, tier.limit - previousLimit);
        if (incomeInTier <= 0) break;
        
        tax += incomeInTier * tier.rate;
        remainingIncome -= incomeInTier;
        previousLimit = tier.limit;
    }

    return Math.floor(tax / 12);
}

// Test cases
console.log('--- SSO Tests ---');
console.log('Base 10,000 -> Expected 500, Actual:', calculateSSO(10000));
console.log('Base 15,000 -> Expected 750, Actual:', calculateSSO(15000));
console.log('Base 20,000 -> Expected 750, Actual:', calculateSSO(20000));

console.log('\n--- PIT Tests (Monthly) ---');
console.log('Annual 150k -> Expected 0, Actual:', calculateIncomeTax(150000));
console.log('Annual 300k -> (150k*0% + 150k*5%) = 7,500/yr -> Expected 625, Actual:', calculateIncomeTax(300000));
console.log('Annual 600k -> (150k*0% + 150k*5% + 200k*10% + 100k*15%) = 7.5k + 20k + 15k = 42,500/yr -> Expected 3541, Actual:', calculateIncomeTax(600000));
