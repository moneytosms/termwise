CREATE TABLE "fee_structure" (
	"id" serial PRIMARY KEY NOT NULL,
	"programme_id" integer NOT NULL,
	"category" text NOT NULL,
	"semester_fee_paise" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship_award" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"scheme_id" integer NOT NULL,
	"semester" integer NOT NULL,
	"amount_paise" integer NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "scholarship_scheme" (
	"id" serial PRIMARY KEY NOT NULL,
	"campus_id" integer NOT NULL,
	"name" text NOT NULL,
	"funding_source" text NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applicant" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "department" ADD COLUMN "sanctioned_posts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_instalment" ADD COLUMN "semester" integer;--> statement-breakpoint
ALTER TABLE "programme" ADD COLUMN "sanctioned_intake" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "designation" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "qualification" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "graduated_on" date;--> statement-breakpoint
ALTER TABLE "fee_structure" ADD CONSTRAINT "fee_structure_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_award" ADD CONSTRAINT "scholarship_award_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_award" ADD CONSTRAINT "scholarship_award_scheme_id_scholarship_scheme_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."scholarship_scheme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_scheme" ADD CONSTRAINT "scholarship_scheme_campus_id_campus_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fee_structure_programme_category_idx" ON "fee_structure" USING btree ("programme_id","category");--> statement-breakpoint
CREATE INDEX "scholarship_award_student_idx" ON "scholarship_award" USING btree ("student_id");