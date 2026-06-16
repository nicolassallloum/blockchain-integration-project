--1--Total Documents
select 
count(*)
from blockchain.kyc_documents

--2--Verified
select count(*) from blockchain.kyc_documents
where kyc_status ='Verified'

--3--Pending
select count(*) from blockchain.kyc_documents
where kyc_status ='Pending'

--4--Rejected
select count(*) from blockchain.kyc_documents
where kyc_status ='Rejected'

--5--Status DropDown
select kyc_status_id as id,status_name as name from blockchain.kyc_statuses
where status_code in ('REJECTED','VERIFIED')


--6--Grid Data
select 
id as "Resident ID",
resident_name as "Full Name",
document_type as "Document Type",
document_number as "Document No.",
Expiry_date as "Expiry_date",
original_file_name as "File",
file_size/1024 as Size,
kyc_status as "Kyc Status",
created_at as "Uploaded At"
from blockchain.kyc_documents 


--7--Rejected Document
update blockchain.kyc_documents
set kyc_status ='Rejected'
where Resident_id = ...

--8--Verified Document
update blockchain.kyc_documents
set kyc_status ='Verified'
where Resident_id = ...