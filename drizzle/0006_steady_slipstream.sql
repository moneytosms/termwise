CREATE TABLE "document_file" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applicant_document" ADD COLUMN "file_id" integer;--> statement-breakpoint
ALTER TABLE "student_document" ADD COLUMN "file_id" integer;--> statement-breakpoint
ALTER TABLE "applicant_document" ADD CONSTRAINT "applicant_document_file_id_document_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."document_file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_document" ADD CONSTRAINT "student_document_file_id_document_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."document_file"("id") ON DELETE no action ON UPDATE no action;