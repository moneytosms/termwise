CREATE TABLE "guardian" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"language" text DEFAULT 'en' NOT NULL,
	CONSTRAINT "guardian_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "guardian_student" (
	"guardian_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"relation" text NOT NULL,
	CONSTRAINT "guardian_student_guardian_id_student_id_pk" PRIMARY KEY("guardian_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "leave_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"kind" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending_parent' NOT NULL,
	"parent_note" text,
	"mentor_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portal_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"kind" text NOT NULL,
	"from_user_id" text NOT NULL,
	"from_name" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reply" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "student_document" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_student" ADD CONSTRAINT "guardian_student_guardian_id_guardian_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardian"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_student" ADD CONSTRAINT "guardian_student_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_request" ADD CONSTRAINT "portal_request_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_request" ADD CONSTRAINT "portal_request_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_document" ADD CONSTRAINT "student_document_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leave_request_student_idx" ON "leave_request" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_document_student_idx" ON "student_document" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_user_id_unique" UNIQUE("user_id");