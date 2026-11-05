CREATE TABLE "applicant" (
	"id" serial PRIMARY KEY NOT NULL,
	"programme_id" integer NOT NULL,
	"batch_id" integer NOT NULL,
	"name" text NOT NULL,
	"birth_date" date NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"guardian_name" text NOT NULL,
	"guardian_phone" text NOT NULL,
	"guardian_email" text,
	"parent_consent_at" timestamp,
	"status" text DEFAULT 'applied' NOT NULL,
	"reject_reason" text,
	"student_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "applicant_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "applicant_document" (
	"id" serial PRIMARY KEY NOT NULL,
	"applicant_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "applicant_document_natural" UNIQUE("applicant_id","name")
);
--> statement-breakpoint
CREATE TABLE "required_document" (
	"id" serial PRIMARY KEY NOT NULL,
	"programme_id" integer NOT NULL,
	"name" text NOT NULL,
	"categories" text[],
	CONSTRAINT "required_document_natural" UNIQUE("programme_id","name")
);
--> statement-breakpoint
CREATE TABLE "staff_leave" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"kind" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"decided_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "programme" ADD COLUMN "semester_fee_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "applicant" ADD CONSTRAINT "applicant_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant" ADD CONSTRAINT "applicant_batch_id_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant" ADD CONSTRAINT "applicant_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applicant_document" ADD CONSTRAINT "applicant_document_applicant_id_applicant_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."applicant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "required_document" ADD CONSTRAINT "required_document_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_leave" ADD CONSTRAINT "staff_leave_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_leave" ADD CONSTRAINT "staff_leave_decided_by_id_staff_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applicant_programme_idx" ON "applicant" USING btree ("programme_id");--> statement-breakpoint
CREATE INDEX "applicant_status_idx" ON "applicant" USING btree ("status");--> statement-breakpoint
CREATE INDEX "staff_leave_staff_idx" ON "staff_leave" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_leave_status_idx" ON "staff_leave" USING btree ("status");