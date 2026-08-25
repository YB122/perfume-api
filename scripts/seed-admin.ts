import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

const email = (process.env.ADMIN_EMAIL ?? 'admin@lumora.shop').toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? 'Admin@123456';
const fullName = process.env.ADMIN_NAME ?? 'Super Admin';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Add it to .env');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'super_admin';
    existing.deletedAt = null;
    await existing.save();
    console.log(`Promoted existing user to super_admin: ${email}`);
  } else {
    const passwordHash = await Bun.password.hash(password, 'bcrypt');
    await User.create({ email, passwordHash, fullName, role: 'super_admin' });
    console.log(`Created super_admin: ${email}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
