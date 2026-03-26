import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Helper functions (copied from server.js for testing)
function calculateIncomeTax(baseSalary, allowances = {}) {
    const annualIncome = baseSalary * 12;
    const expenses = Math.min(annualIncome * 0.5, 100000);
    let totalAllowances = 60000;
    if (allowances.spouse_allowance) totalAllowances += 60000;
    totalAllowances += (parseInt(allowances.children_count || 0) * 30000);
    totalAllowances += (parseInt(allowances.parents_care_count || 0) * 30000);
    const health = Math.min(parseFloat(allowances.health_insurance || 0), 25000);
    const life = parseFloat(allowances.life_insurance || 0);
    totalAllowances += Math.min(health + life, 100000);
    totalAllowances += 9000; 

    const taxableIncome = Math.max(0, annualIncome - expenses - totalAllowances);
    if (taxableIncome <= 150000) return 0;
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
    let remainingIncome = taxableIncome;
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

async function testTax() {
    console.log("--- Testing Tax Calculation ---");
    // Case 1: Low income (30,000 / month)
    const t1 = calculateIncomeTax(30000, { children_count: 0 });
    console.log(`Income 30,000/mo, No children: Tax = ${t1} (Expected 0 if below threshold)`);
    
    // Case 2: High income (100,000 / month)
    const t2 = calculateIncomeTax(100000, { children_count: 2, spouse_allowance: 1 });
    console.log(`Income 100,000/mo, 2 children, spouse: Tax = ${t2}`);

    // Case 3: Very High (200,000 / month)
    const t3 = calculateIncomeTax(200000, {});
    console.log(`Income 200,000/mo, no extra allowances: Tax = ${t3}`);
}

testTax();
