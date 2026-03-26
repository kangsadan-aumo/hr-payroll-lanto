import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

function calculateOTPay(baseSalary, hours, multiplier) {
    const hourlyRate = (baseSalary / 30 / 8);
    return Math.floor(hourlyRate * hours * multiplier);
}

function calculateSSO(baseSalary) {
    return Math.min(Math.floor(baseSalary * 0.05), 750);
}

async function testPayroll() {
    console.log("--- Testing OT & Payroll Components ---");
    const base = 50000;
    
    const ot15 = calculateOTPay(base, 10, 1.5);
    const ot3 = calculateOTPay(base, 5, 3.0);
    const sso = calculateSSO(base);
    const pvfRate = 3;
    const pvf = Math.floor(base * (pvfRate / 100));

    console.log(`Base: ฿${base}`);
    console.log(`OT 1.5 (10h): ฿${ot15}`);
    console.log(`OT 3.0 (5h): ฿${ot3}`);
    console.log(`SSO: ฿${sso}`);
    console.log(`PVF (3%): ฿${pvf}`);
    
    const gross = base + ot15 + ot3;
    console.log(`Gross Salary: ฿${gross}`);
}

testPayroll();
