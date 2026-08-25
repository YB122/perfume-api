import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

await mongoose.connect(process.env.MONGODB_URI!);
const u = await User.findOne({ role: 'super_admin' }).select('email role createdAt');
console.log(JSON.stringify(u, null, 2));
await mongoose.disconnect();
