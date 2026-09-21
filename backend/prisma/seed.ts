import "dotenv/config";
import { PrismaClient, Priority, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = "Password123!";

async function main() {
  // Clear existing data (order matters because of foreign keys)
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: { name: "Sejal Sukande", email: "sejal@velozity.test", passwordHash, role: "ADMIN" },
  });

  const pm1 = await prisma.user.create({
    data: { name: "Sakshi Joshi", email: "sakshi.pm@velozity.test", passwordHash, role: "PM" },
  });
  const pm2 = await prisma.user.create({
    data: { name: "Akhilesh Kulkarni", email: "akhilesh.pm@velozity.test", passwordHash, role: "PM" },
  });

  const dev1 = await prisma.user.create({
    data: { name: "Aryan Tambe", email: "aryan.dev@velozity.test", passwordHash, role: "DEVELOPER" },
  });
  const dev2 = await prisma.user.create({
    data: { name: "Himanshu Sharma", email: "himanshu.dev@velozity.test", passwordHash, role: "DEVELOPER" },
  });
  const dev3 = await prisma.user.create({
    data: { name: "Vaibhavi Jambhale", email: "vaibhavi.dev@velozity.test", passwordHash, role: "DEVELOPER" },
  });
  const dev4 = await prisma.user.create({
    data: { name: "Sharvaree Bhagwat", email: "sharvaree.dev@velozity.test", passwordHash, role: "DEVELOPER" },
  });

  const developers = [dev1, dev2, dev3, dev4];

  const client1 = await prisma.client.create({
    data: { name: "Swapnali Ingole", contactInfo: "swapnali.ingole@client.test" },
  });
  const client2 = await prisma.client.create({
    data: { name: "Ram Kapoor", contactInfo: "ram.kapoor@client.test" },
  });

  const project1 = await prisma.project.create({
    data: { name: "Reflection App", clientId: client1.id, createdById: pm1.id },
  });
  const project2 = await prisma.project.create({
    data: { name: "Blind Canvas", clientId: client1.id, createdById: pm1.id },
  });
  const project3 = await prisma.project.create({
    data: { name: "Job Hunter", clientId: client2.id, createdById: pm2.id },
  });

  const projects = [project1, project2, project3];

  const statusCycle: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "TODO", "IN_PROGRESS"];
  const priorityCycle: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL", "MEDIUM", "HIGH"];

  const now = new Date();
  const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  let overdueCount = 0;

  for (const project of projects) {
    for (let i = 0; i < 6; i++) {
      const status = statusCycle[i];
      const priority = priorityCycle[i];
      const assignedTo = developers[i % developers.length];

      // Make sure at least 2 tasks overall end up overdue (past due date, not yet done)
      const shouldBeOverdue = overdueCount < 2 && status !== "DONE" && i === 0;
      const dueDate = shouldBeOverdue ? daysFromNow(-3) : daysFromNow(3 + i);
      const isOverdue = shouldBeOverdue;
      if (shouldBeOverdue) overdueCount++;

      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          title: `${project.name} - Task ${i + 1}`,
          description: `Auto-generated seed task ${i + 1} for ${project.name}`,
          assignedToId: assignedTo.id,
          status,
          priority,
          dueDate,
          isOverdue,
        },
      });

      // Pre-existing activity log entries so the feed isn't empty on first load.
      // Only log a transition for tasks that aren't still in their initial TODO state.
      if (status !== "TODO") {
        await prisma.activityLog.create({
          data: {
            taskId: task.id,
            userId: assignedTo.id,
            fromStatus: "TODO",
            toStatus: status,
          },
        });
      }

    }
  }

  console.log("Seed complete.");
  console.log(`All seeded users share the password: ${SEED_PASSWORD}`);
  console.log("Admin:", admin.email);
  console.log("PMs:", pm1.email, pm2.email);
  console.log("Developers:", developers.map((d) => d.email).join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
