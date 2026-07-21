// scripts/check-users.js
// ==================== DNS OVERRIDE ====================
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
console.log('✅ DNS servers set');

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../src/models/User.model');

async function checkUsers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log(`📡 URI: ${process.env.MONGODB_URI ? '✅ Found' : '❌ Not found'}`);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });
    console.log('✅ Connected\n');

    const count = await User.countDocuments();
    console.log(`📊 Total users: ${count}`);

    if (count > 0) {
      const users = await User.find({}).select('email fullName role');
      console.log('\n👤 Users:');
      users.forEach(u => {
        console.log(`  - ${u.email} (${u.fullName}) - ${u.role}`);
      });

      // Check superadmin password
      const superAdmin = await User.findOne({ email: 'superadmin@taskmanager.com' }).select('+password');
      if (superAdmin) {
        console.log('\n🔐 SuperAdmin found!');
        const isValid = await bcrypt.compare('Admin@123', superAdmin.password);
        console.log(`   Password "Admin@123" matches: ${isValid ? '✅ YES' : '❌ NO'}`);
        
        if (!isValid) {
          console.log('\n⚠️ Password does not match! Updating...');
          const newHash = await bcrypt.hash('Admin@123', 10);
          await User.updateOne(
            { email: 'superadmin@taskmanager.com' },
            { $set: { password: newHash } }
          );
          console.log('✅ Password updated!');
        }
      } else {
        console.log('\n❌ SuperAdmin not found! Creating...');
        const hash = await bcrypt.hash('Admin@123', 10);
        await User.create({
          fullName: 'System Super Admin',
          email: 'superadmin@taskmanager.com',
          password: hash,
          employeeId: 'SA001',
          role: 'super_admin',
          isActive: true,
          firstLogin: false
        });
        console.log('✅ SuperAdmin created!');
      }
    } else {
      console.log('❌ No users found in database!');
      console.log('\n📝 Creating users...');
      
      const hash = await bcrypt.hash('Admin@123', 10);
      
      const users = [
        { fullName: 'System Super Admin', email: 'superadmin@taskmanager.com', employeeId: 'SA001', role: 'super_admin' },
        { fullName: 'System Admin', email: 'admin@taskmanager.com', employeeId: 'AD001', role: 'admin' },
        { fullName: 'HR Manager', email: 'hr@taskmanager.com', employeeId: 'HR001', role: 'hr_manager' },
        { fullName: 'Department Manager', email: 'manager@taskmanager.com', employeeId: 'MGR001', role: 'dept_manager' },
        { fullName: 'Project Manager', email: 'pm@taskmanager.com', employeeId: 'PM001', role: 'project_manager' },
        { fullName: 'John Employee', email: 'employee@taskmanager.com', employeeId: 'EMP001', role: 'employee' }
      ];

      for (const u of users) {
        await User.create({
          ...u,
          password: hash,
          isActive: true,
          firstLogin: false
        });
        console.log(`  ✅ Created: ${u.email}`);
      }
      console.log('\n✅ All users created!');
    }

    // Show final count
    const finalCount = await User.countDocuments();
    console.log(`\n📊 Final user count: ${finalCount}`);

    await mongoose.connection.close();
    console.log('\n✅ Done!');
    
    console.log('\n🔐 LOGIN CREDENTIALS:');
    console.log('========================================');
    console.log('Super Admin:   superadmin@taskmanager.com / Admin@123');
    console.log('Admin:         admin@taskmanager.com / Admin@123');
    console.log('HR Manager:    hr@taskmanager.com / Admin@123');
    console.log('Dept Manager:  manager@taskmanager.com / Admin@123');
    console.log('Project Mgr:   pm@taskmanager.com / Admin@123');
    console.log('Employee:      employee@taskmanager.com / Admin@123');
    console.log('========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('📚 Stack:', error.stack);
    
    if (error.name === 'MongooseServerSelectionError') {
      console.log('\n💡 TROUBLESHOOTING:');
      console.log('  1. Make sure your IP is whitelisted in MongoDB Atlas');
      console.log('  2. Check your internet connection');
      console.log('  3. Verify MONGODB_URI in .env file');
    }
    process.exit(1);
  }
}

checkUsers();