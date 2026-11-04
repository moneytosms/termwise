import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { parentToken } from "../src/server/parent-link";

// Needs the same BETTER_AUTH_SECRET and DATABASE_URL as the server under test.
async function studentWithDue() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(`select s.id from student s join fee_instalment i on i.student_id = s.id
    left join fee_payment p on p.instalment_id = i.id where s.roll_no not in ('ENG-24-ME-0177', 'ENG-24-CSE-0412', 'MBA-25-0093') group by s.id, i.id
    having i.amount_paise - i.scholarship_paise - coalesce(sum(p.amount_paise), 0) > 0 order by s.id desc limit 1`);
  await pool.end();
  return rows[0].id as number;
}

test("a parent sees attendance and dues, pays in test mode and gets a receipt", async ({ page }) => {
  const token = parentToken(await studentWithDue());
  await page.goto(`/p/${token}`);
  await expect(page.getByText(/attendance/i).first()).toBeVisible();
  await page.getByRole("button", { name: /Pay .* \(test mode\)/ }).first().click();
  await page.waitForURL(/\/receipt\/\d+/);
  await expect(page.getByText(/R-\d{6}/)).toBeVisible();
  await expect(page.getByText(/TEST-[A-Z]{8}/)).toBeVisible();
});

test("a tampered or expired link shows nothing about the student", async ({ page }) => {
  const [id, exp, sig] = parentToken(1).split(".");
  for (const t of [`${Number(id) + 1}.${exp}.${sig}`, parentToken(1, Date.now() - 31 * 86_400_000)]) {
    await page.goto(`/p/${t}`);
    await expect(page.getByText("This link has expired or isn't valid.", { exact: false })).toBeVisible();
  }
});
