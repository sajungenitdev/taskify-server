// scripts/syncPinnedMessages.js
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { Channel } = require("../src/models/Channel.model");
const { Message } = require("../src/models/Message.model");

const syncPinnedMessages = async () => {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB");

        const channels = await Channel.find({});
        console.log(`📌 Found ${channels.length} channels`);

        let totalAdded = 0;

        for (const channel of channels) {
            console.log(`\n📌 Processing: ${channel.name} (${channel._id})`);

            const pinnedMessages = await Message.find({
                channelId: channel._id,
                isPinned: true,
                isDeleted: false,
            });

            if (pinnedMessages.length === 0) {
                console.log(`  ℹ️ No pinned messages`);
                continue;
            }

            console.log(`  📌 Found ${pinnedMessages.length} pinned messages`);

            let added = 0;

            for (const msg of pinnedMessages) {
                // Check if already exists
                const exists = channel.pinnedFiles.some(
                    (f) => f.messageId?.toString() === msg._id.toString()
                );

                if (!exists) {
                    // ✅ FIX: Create a clean object with proper types
                    const pinnedFile = {
                        name: String(msg.content || "Pinned message"),
                        url: String(`/messages/${msg._id}`),
                        size: Number(0),
                        type: String('message'),
                        messageId: msg._id, // This will be converted to ObjectId by Mongoose
                        uploadedBy: {
                            _id: msg.senderId,
                            fullName: String(msg.senderId?.fullName || 'Unknown'),
                        },
                        uploadedAt: msg.createdAt || new Date(),
                    };

                    channel.pinnedFiles.push(pinnedFile);
                    added++;
                    console.log(`    ✅ Added: "${msg.content?.substring(0, 30) || 'Pinned'}"`);
                }

                // Also add attachments if present
                if (msg.attachments && msg.attachments.length > 0) {
                    for (const att of msg.attachments) {
                        const attExists = channel.pinnedFiles.some(
                            (f) => f.url === att.url
                        );
                        if (!attExists) {
                            const attFile = {
                                name: String(att.name),
                                url: String(att.url),
                                size: Number(att.size || 0),
                                type: String(att.type || 'file'),
                                messageId: msg._id,
                                uploadedBy: {
                                    _id: msg.senderId,
                                    fullName: String(msg.senderId?.fullName || 'Unknown'),
                                },
                                uploadedAt: msg.createdAt || new Date(),
                            };
                            channel.pinnedFiles.push(attFile);
                            added++;
                        }
                    }
                }
            }

            if (added > 0) {
                await channel.save();
                console.log(`  ✅ Added ${added} items to channel`);
                totalAdded += added;
            }
        }

        console.log(`\n✅ Total pinned items added: ${totalAdded}`);
        console.log("🎉 Sync completed successfully!");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

syncPinnedMessages();