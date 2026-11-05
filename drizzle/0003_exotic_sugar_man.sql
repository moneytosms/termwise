CREATE TABLE "appeal" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"kind" text NOT NULL,
	"component_id" integer,
	"session_id" uuid,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"response" text,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "address_line1" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "pincode" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "affiliation" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "registration_no" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "logo_data_url" text;--> statement-breakpoint
ALTER TABLE "campus" ADD COLUMN "receipt_footer" text;--> statement-breakpoint
ALTER TABLE "mark_component" ADD COLUMN "section" text DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "kind" text DEFAULT 'theory' NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "internal_max" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "mid_max" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "end_max" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "theory_scale" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "lab_exam_max" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "viva_max" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "ce_max" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "appeal" ADD CONSTRAINT "appeal_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeal" ADD CONSTRAINT "appeal_component_id_mark_component_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."mark_component"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeal" ADD CONSTRAINT "appeal_session_id_attendance_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeal" ADD CONSTRAINT "appeal_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appeal_student_idx" ON "appeal" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "appeal_status_idx" ON "appeal" USING btree ("status");