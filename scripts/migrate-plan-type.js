const mongoose = require("mongoose");
// ✅ Fix the path - go up one level from scripts folder
const { PricingPlan } = require("../models/PricingPlan.model");
require("dotenv").config();

async function migratePlanType() {
    try {
        // Connect to MongoDB - use your actual connection string
        const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/task-management";
        await mongoose.connect(mongoURI);
        console.log("✅ Connected to MongoDB");

        // Get all plans
        const plans = await PricingPlan.find({});
        console.log(`📋 Found ${plans.length} plans`);

        if (plans.length === 0) {
            console.log("⚠️ No plans found to migrate");
            process.exit(0);
        }

        let updatedCount = 0;
        let skippedCount = 0;

        for (const plan of plans) {
            // Skip if planType already exists
            if (plan.planType) {
                console.log(`⏭️ Skipped "${plan.name}" - already has type: ${plan.planType}`);
                skippedCount++;
                continue;
            }

            // Determine plan type from limits.users
            let planType = "individual"; // default
            
            if (plan.limits && plan.limits.users !== undefined) {
                if (plan.limits.users === 1) {
                    planType = "individual";
                } else if (plan.limits.users > 1) {
                    planType = "team";
                }
            }

            // Update the plan
            plan.planType = planType;
            await plan.save();
            updatedCount++;
            console.log(`✅ Updated "${plan.name}" (users: ${plan.limits?.users || 0}) → ${planType}`);
        }

        console.log(`\n📊 Migration Summary:`);
        console.log(`   ✅ Updated: ${updatedCount} plans`);
        console.log(`   ⏭️ Skipped: ${skippedCount} plans`);
        console.log(`   📋 Total: ${plans.length} plans`);

        // Verify migration
        const individualCount = await PricingPlan.countDocuments({ planType: "individual" });
        const teamCount = await PricingPlan.countDocuments({ planType: "team" });
        console.log(`\n📊 After Migration:`);
        console.log(`   👤 Individual plans: ${individualCount}`);
        console.log(`   👥 Team plans: ${teamCount}`);

        await mongoose.disconnect();
        console.log("✅ Disconnected from MongoDB");
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the migration
migratePlanType();