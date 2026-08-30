// scripts/fix-archived-projects.js
require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/task-management';

async function fixArchivedProjects() {
  console.log('🚀 Starting Archive Projects Fix Script...');
  console.log('============================================\n');

  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    console.log(`📡 Using URI: ${MONGODB_URI.replace(/\/\/[^@]+@/, '//****:****@')}`);
    
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB successfully\n');

    // Get the collection directly
    const db = conn.connection.db;
    const projectsCollection = db.collection('projects');

    // ============================================================
    // 1. UPDATE ARCHIVED PROJECTS - Set isActive: true
    // ============================================================
    console.log('📋 Step 1: Updating archived projects...');
    const archiveResult = await projectsCollection.updateMany(
      { status: 'archived' },
      { 
        $set: { 
          isActive: true,
          archivedAt: new Date()
        } 
      }
    );
    console.log(`✅ Updated ${archiveResult.modifiedCount} archived projects with isActive: true`);

    // ============================================================
    // 2. FIX BUDGET FIELD - Convert number to object
    // ============================================================
    console.log('\n📋 Step 2: Fixing budget fields...');
    const projectsWithBudgetNumber = await projectsCollection.find({ 
      budget: { $type: 'number' } 
    }).toArray();

    let budgetFixCount = 0;
    for (const project of projectsWithBudgetNumber) {
      const budgetValue = project.budget || 0;
      await projectsCollection.updateOne(
        { _id: project._id },
        { 
          $set: { 
            budget: { 
              allocated: budgetValue, 
              spent: 0, 
              currency: 'USD' 
            } 
          } 
        }
      );
      budgetFixCount++;
      console.log(`  ✅ Fixed budget for: ${project.name} (${project.code})`);
    }
    console.log(`✅ Fixed budget for ${budgetFixCount} projects`);

    // ============================================================
    // 3. FIX NULL BUDGET - Set default budget object
    // ============================================================
    console.log('\n📋 Step 3: Fixing null/undefined budget fields...');
    const projectsWithNullBudget = await projectsCollection.find({
      $or: [
        { budget: null },
        { budget: { $exists: false } }
      ]
    }).toArray();

    let nullBudgetCount = 0;
    for (const project of projectsWithNullBudget) {
      await projectsCollection.updateOne(
        { _id: project._id },
        { 
          $set: { 
            budget: { 
              allocated: 0, 
              spent: 0, 
              currency: 'USD' 
            } 
          } 
        }
      );
      nullBudgetCount++;
      console.log(`  ✅ Set default budget for: ${project.name} (${project.code})`);
    }
    console.log(`✅ Fixed ${nullBudgetCount} projects with null budget`);

    // ============================================================
    // 4. SHOW SUMMARY
    // ============================================================
    console.log('\n📊 SUMMARY');
    console.log('============================================');
    
    const totalProjects = await projectsCollection.countDocuments();
    const archivedCount = await projectsCollection.countDocuments({ status: 'archived' });
    const activeCount = await projectsCollection.countDocuments({ status: 'active' });
    const planningCount = await projectsCollection.countDocuments({ status: 'planning' });
    const onHoldCount = await projectsCollection.countDocuments({ status: 'on_hold' });
    const completedCount = await projectsCollection.countDocuments({ status: 'completed' });
    const cancelledCount = await projectsCollection.countDocuments({ status: 'cancelled' });
    
    console.log(`📁 Total Projects: ${totalProjects}`);
    console.log(`📁 Archived Projects: ${archivedCount}`);
    console.log(`📁 Active Projects: ${activeCount}`);
    console.log(`📁 Planning Projects: ${planningCount}`);
    console.log(`📁 On Hold Projects: ${onHoldCount}`);
    console.log(`📁 Completed Projects: ${completedCount}`);
    console.log(`📁 Cancelled Projects: ${cancelledCount}`);

    // ============================================================
    // 5. SHOW ALL ARCHIVED PROJECTS
    // ============================================================
    console.log('\n📁 Archived Projects List:');
    console.log('============================================');
    const archivedProjects = await projectsCollection.find({ status: 'archived' })
      .project({ name: 1, code: 1, status: 1, isActive: 1, archivedAt: 1 })
      .sort({ archivedAt: -1 })
      .toArray();

    if (archivedProjects.length === 0) {
      console.log('No archived projects found');
    } else {
      archivedProjects.forEach((project, index) => {
        console.log(`${index + 1}. ${project.name} (${project.code})`);
        console.log(`   Status: ${project.status}`);
        console.log(`   isActive: ${project.isActive}`);
        console.log(`   Archived At: ${project.archivedAt || 'N/A'}`);
        console.log('   ---');
      });
    }

    // ============================================================
    // 6. FIX ACTIVE PROJECTS WITH isActive: false
    // ============================================================
    console.log('\n📋 Step 4: Fixing active projects with isActive: false...');
    const activeProjectsWithFalse = await projectsCollection.find({
      status: { $ne: 'archived' },
      isActive: false
    }).toArray();

    let activeFixCount = 0;
    for (const project of activeProjectsWithFalse) {
      await projectsCollection.updateOne(
        { _id: project._id },
        { 
          $set: { 
            isActive: true
          } 
        }
      );
      activeFixCount++;
      console.log(`  ✅ Fixed isActive for: ${project.name} (${project.code})`);
    }
    console.log(`✅ Fixed ${activeFixCount} active projects with isActive: false`);

    console.log('\n✅ Script completed successfully!');
    console.log('============================================');

  } catch (error) {
    console.error('\n❌ Error occurred:', error.message);
    console.error(error.stack);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the script
fixArchivedProjects();