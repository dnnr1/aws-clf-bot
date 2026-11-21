ALTER TABLE "questions" ADD COLUMN "family_id" varchar(80);
--> statement-breakpoint
UPDATE "questions" SET "family_id" = "id"::text WHERE "family_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "family_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX "questions_exam_family_idx" ON "questions" USING btree ("certification_id","domain_id","family_id","is_active");
--> statement-breakpoint
INSERT INTO "exam_objectives" (
	"id",
	"certification_id",
	"domain_id",
	"objective_code",
	"description_en",
	"description_pt_br"
)
VALUES
	('clf-c02-1-1', 'aws-clf-c02', 'cloud-concepts', '1.1', 'Define the benefits of the AWS Cloud.', 'Definir os benefícios da Nuvem AWS.'),
	('clf-c02-1-2', 'aws-clf-c02', 'cloud-concepts', '1.2', 'Identify design principles of the AWS Cloud.', 'Identificar princípios de design da Nuvem AWS.'),
	('clf-c02-1-3', 'aws-clf-c02', 'cloud-concepts', '1.3', 'Understand the benefits of and strategies for migration to the AWS Cloud.', 'Compreender os benefícios e as estratégias de migração para a Nuvem AWS.'),
	('clf-c02-1-4', 'aws-clf-c02', 'cloud-concepts', '1.4', 'Understand concepts of cloud economics.', 'Compreender conceitos de economia da nuvem.'),
	('clf-c02-2-2', 'aws-clf-c02', 'security-compliance', '2.2', 'Understand AWS Cloud security, governance, and compliance concepts.', 'Compreender conceitos de segurança, governança e conformidade na Nuvem AWS.'),
	('clf-c02-2-3', 'aws-clf-c02', 'security-compliance', '2.3', 'Identify AWS access management capabilities.', 'Identificar recursos de gerenciamento de acesso da AWS.'),
	('clf-c02-2-4', 'aws-clf-c02', 'security-compliance', '2.4', 'Identify components and resources for security.', 'Identificar componentes e recursos de segurança.'),
	('clf-c02-3-1', 'aws-clf-c02', 'cloud-technology-services', '3.1', 'Define methods of deploying and operating in the AWS Cloud.', 'Definir métodos de implantação e operação na Nuvem AWS.'),
	('clf-c02-3-2', 'aws-clf-c02', 'cloud-technology-services', '3.2', 'Define the AWS global infrastructure.', 'Definir a infraestrutura global da AWS.'),
	('clf-c02-3-3', 'aws-clf-c02', 'cloud-technology-services', '3.3', 'Identify AWS compute services.', 'Identificar serviços de computação da AWS.'),
	('clf-c02-3-4', 'aws-clf-c02', 'cloud-technology-services', '3.4', 'Identify AWS database services.', 'Identificar serviços de banco de dados da AWS.'),
	('clf-c02-3-5', 'aws-clf-c02', 'cloud-technology-services', '3.5', 'Identify AWS network services.', 'Identificar serviços de rede da AWS.'),
	('clf-c02-3-6', 'aws-clf-c02', 'cloud-technology-services', '3.6', 'Identify AWS storage services.', 'Identificar serviços de armazenamento da AWS.'),
	('clf-c02-3-7', 'aws-clf-c02', 'cloud-technology-services', '3.7', 'Identify AWS AI/ML and analytics services.', 'Identificar serviços de IA/ML e análise de dados da AWS.'),
	('clf-c02-3-8', 'aws-clf-c02', 'cloud-technology-services', '3.8', 'Identify services from other in-scope AWS service categories.', 'Identificar serviços de outras categorias incluídas no escopo da AWS.'),
	('clf-c02-4-1', 'aws-clf-c02', 'billing-pricing-support', '4.1', 'Compare AWS pricing models.', 'Comparar modelos de preço da AWS.'),
	('clf-c02-4-2', 'aws-clf-c02', 'billing-pricing-support', '4.2', 'Understand resources for billing, budget, and cost management.', 'Compreender recursos de faturamento, orçamento e gerenciamento de custos.'),
	('clf-c02-4-3', 'aws-clf-c02', 'billing-pricing-support', '4.3', 'Identify AWS technical resources and AWS Support options.', 'Identificar recursos técnicos da AWS e opções de suporte da AWS.')
ON CONFLICT ("certification_id", "objective_code") DO NOTHING;
