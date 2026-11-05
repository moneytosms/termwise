CREATE TABLE "report_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"campus_id" integer NOT NULL,
	"month" text NOT NULL,
	"report" text NOT NULL,
	"rows" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_snapshot_natural" UNIQUE("campus_id","month","report")
);
--> statement-breakpoint
CREATE TABLE "result" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"internal" numeric(5, 2) NOT NULL,
	"theory_scaled" numeric(5, 2) NOT NULL,
	"lab" numeric(5, 2) NOT NULL,
	"total" numeric(5, 2) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_subject_student" UNIQUE("subject_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "report_snapshot" ADD CONSTRAINT "report_snapshot_campus_id_campus_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result" ADD CONSTRAINT "result_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result" ADD CONSTRAINT "result_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE no action ON UPDATE no action;