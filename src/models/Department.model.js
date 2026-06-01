const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String },
    headOfDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeCount: { type: Number, default: 0 },
    settings: {
      workStartTime: { type: String, default: '09:00' },
      workEndTime: { type: String, default: '18:00' },
      gracePeriodMinutes: { type: Number, default: 15 },
      breakDurationMinutes: { type: Number, default: 60 },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = { Department: mongoose.model('Department', departmentSchema) };