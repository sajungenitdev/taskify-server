// scripts/seed-chat-data.js
require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../src/models/User.model');
const { Channel } = require('../src/models/Channel.model');
const { Message } = require('../src/models/Message.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/task-management';

async function seedChatData() {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('         SEEDING DEMO CHAT DATA');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all active users
    const users = await User.find({ isActive: true });
    if (users.length === 0) {
      console.log('❌ No active users found.');
      return;
    }

    console.log(`👥 Found ${users.length} active users:`);
    users.slice(0, 10).forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.fullName} (${u.email}) - ${u.role}`);
    });
    if (users.length > 10) {
      console.log(`   ... and ${users.length - 10} more users`);
    }

    // Check if chat data already exists
    const existingChannels = await Channel.countDocuments();
    if (existingChannels > 0) {
      console.log(`\n⚠️ Found ${existingChannels} existing channels.`);
      console.log('🗑️ Clearing existing chat data...');
      await Channel.deleteMany({});
      await Message.deleteMany({});
      console.log('✅ Cleared existing chat data\n');
    }

    // Create demo channels
    const channelData = [
      { 
        name: 'general', 
        type: 'public', 
        description: '💬 General discussion for the whole team' 
      },
      { 
        name: 'software-dev', 
        type: 'public', 
        description: '💻 Software development discussions and code reviews' 
      },
      { 
        name: 'commercial', 
        type: 'public', 
        description: '📊 Commercial discussions and client updates' 
      },
      { 
        name: 'accounts', 
        type: 'public', 
        description: '💰 Financial and accounting discussions' 
      },
      { 
        name: 'project-alpha', 
        type: 'private', 
        description: '🔒 Project Alpha team discussion' 
      },
    ];

    const channels = [];
    console.log('📁 Creating channels...\n');

    // Get admin user (first user or user with super_admin role)
    const adminUser = users.find(u => u.role === 'super_admin') || users[0];

    for (const data of channelData) {
      const channel = new Channel({
        name: data.name,
        type: data.type,
        description: data.description,
        createdBy: adminUser._id,
        members: users.map(u => ({
          userId: u._id,
          role: u._id === adminUser._id ? 'admin' : 'member',
          joinedAt: new Date(),
          lastReadAt: new Date(),
        })),
      });
      await channel.save();
      channels.push(channel);
      console.log(`✅ Created #${channel.name} channel (${channel.type})`);
    }

    console.log('\n📝 Creating demo messages...\n');

    // Get a few users for messages
    const msgUsers = users.slice(0, Math.min(5, users.length));
    
    // Message templates with different senders
    const messagesData = [
      // General Channel Messages
      {
        channel: 'general',
        content: '👋 Welcome everyone! This is the general channel for team discussions.',
        sender: msgUsers[0] || users[0],
      },
      {
        channel: 'general',
        content: `@${msgUsers[1]?.fullName || 'Team'} Can you please share the meeting notes from yesterday?`,
        sender: msgUsers[0] || users[0],
        mentions: [msgUsers[1]?._id],
      },
      {
        channel: 'general',
        content: 'Sure! I\'ll share them in a few minutes. 📝',
        sender: msgUsers[1] || users[1] || users[0],
      },
      {
        channel: 'general',
        content: '📢 Reminder: Team meeting at 3 PM today. Don\'t forget to bring your updates!',
        sender: msgUsers[2] || users[2] || users[0],
      },
      {
        channel: 'general',
        content: '🎉 Happy Friday everyone! Great work this week!',
        sender: msgUsers[0] || users[0],
      },

      // Software Development Channel Messages
      {
        channel: 'software-dev',
        content: '🌅 Morning team! Booking API deadline is Friday — anyone blocked on anything?',
        sender: msgUsers[0] || users[0],
      },
      {
        channel: 'software-dev',
        content: `@${msgUsers[0]?.fullName || 'Admin'} Auth JWT refresh is done and pushed. @${msgUsers[2]?.fullName || 'Team'} can integrate now.`,
        sender: msgUsers[1] || users[1] || users[0],
        mentions: [msgUsers[0]?._id, msgUsers[2]?._id],
      },
      {
        channel: 'software-dev',
        content: 'Great! Will integrate after lunch. 🍽️ Also found a bug in the booking endpoint — creating a task for it now.',
        sender: msgUsers[2] || users[2] || users[0],
      },
      {
        channel: 'software-dev',
        content: '🚀 Deployment to staging is complete. Please test the new features.',
        sender: msgUsers[3] || users[3] || users[0],
      },
      {
        channel: 'software-dev',
        content: '📚 Documentation updated with the new API changes. Check the wiki.',
        sender: msgUsers[0] || users[0],
      },

      // Commercial Channel Messages
      {
        channel: 'commercial',
        content: '📋 DPDC tender update: The submission deadline has been extended to next Friday.',
        sender: msgUsers[0] || users[0],
      },
      {
        channel: 'commercial',
        content: `@${msgUsers[3]?.fullName || 'Team'} Can you prepare the revised proposal by Wednesday?`,
        sender: msgUsers[0] || users[0],
        mentions: [msgUsers[3]?._id],
      },
      {
        channel: 'commercial',
        content: 'Already working on it. Will have it ready by Wednesday morning. 📄',
        sender: msgUsers[3] || users[3] || users[0],
      },
      {
        channel: 'commercial',
        content: '💰 New client inquiry: ABC Corp is interested in our enterprise solution.',
        sender: msgUsers[1] || users[1] || users[0],
      },

      // Accounts Channel Messages
      {
        channel: 'accounts',
        content: '📊 July VAT returns are ready for review.',
        sender: msgUsers[1] || users[1] || users[0],
      },
      {
        channel: 'accounts',
        content: `@${msgUsers[0]?.fullName || 'Admin'} Can you please approve the VAT returns by tomorrow?`,
        sender: msgUsers[1] || users[1] || users[0],
        mentions: [msgUsers[0]?._id],
      },
      {
        channel: 'accounts',
        content: 'I\'ll review them first thing in the morning. ✅',
        sender: msgUsers[0] || users[0],
      },
      {
        channel: 'accounts',
        content: '💰 Monthly expense report has been generated. Check the finance dashboard.',
        sender: msgUsers[2] || users[2] || users[0],
      },

      // Project Alpha Channel (Private)
      {
        channel: 'project-alpha',
        content: '🔒 Welcome to Project Alpha channel. This is a private channel for the core team.',
        sender: msgUsers[0] || users[0],
      },
      {
        channel: 'project-alpha',
        content: '📋 Project Alpha: Sprint planning meeting at 11 AM.',
        sender: msgUsers[0] || users[0],
      },
      {
        channel: 'project-alpha',
        content: '🚀 We\'re launching the MVP next month. Let\'s focus on the core features.',
        sender: msgUsers[2] || users[2] || users[0],
      },
    ];

    let messageCount = 0;
    for (const msgData of messagesData) {
      const channel = channels.find(c => c.name === msgData.channel);
      if (!channel) continue;

      const sender = msgData.sender || users[0];
      const mentions = msgData.mentions?.filter(Boolean).map(userId => ({
        userId,
        name: users.find(u => u._id.toString() === userId?.toString())?.fullName || 'Unknown',
        readAt: null,
      })) || [];

      const message = new Message({
        channelId: channel._id,
        senderId: sender._id,
        content: msgData.content,
        type: 'text',
        mentions: mentions,
        readBy: [
          {
            userId: sender._id,
            readAt: new Date(),
          },
        ],
        createdAt: new Date(Date.now() - (messageCount * 300000)),
        updatedAt: new Date(Date.now() - (messageCount * 300000)),
      });

      await message.save();
      messageCount++;

      console.log(`✅ Message #${messageCount} in #${channel.name}: "${msgData.content.substring(0, 40)}${msgData.content.length > 40 ? '...' : ''}"`);
    }

    // Add some reactions to messages
    const allMessages = await Message.find({});
    const reactions = ['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '🔥', '💯', '🚀'];
    
    let reactionCount = 0;
    for (const message of allMessages) {
      if (Math.random() > 0.6) continue;
      
      const numReactions = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numReactions; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const randomEmoji = reactions[Math.floor(Math.random() * reactions.length)];
        
        const existing = message.reactions.find(
          r => r.userId.toString() === randomUser._id.toString() && r.emoji === randomEmoji
        );
        if (!existing) {
          message.reactions.push({
            emoji: randomEmoji,
            userId: randomUser._id,
            createdAt: new Date(),
          });
          reactionCount++;
        }
      }
      await message.save();
    }

    console.log(`\n📊 Summary:`);
    console.log(`   • ${channels.length} channels created`);
    console.log(`   • ${messageCount} messages created`);
    console.log(`   • ${reactionCount} reactions added`);
    console.log(`   • ${users.length} users in the system`);

    console.log('\n✅ Demo chat data seeded successfully!');
    console.log('\n📝 Channel List:');
    for (const c of channels) {
      const msgCount = await Message.countDocuments({ channelId: c._id });
      console.log(`   • #${c.name} - ${c.members.length} members, ${msgCount} messages`);
    }

    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('💡 Next steps:');
    console.log('   1. Start your frontend: npm run dev');
    console.log('   2. Navigate to /team-chat');
    console.log('   3. Login with any user account');
    console.log('   4. Start chatting! 🎉');
    console.log('───────────────────────────────────────────────────────────────\n');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB\n');
  }
}

// Run the seed function
seedChatData();