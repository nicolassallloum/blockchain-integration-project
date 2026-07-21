DROP TRIGGER IF EXISTS trg_blockchain_audit_capture ON sdedba.cfg_customer_def;
CREATE TRIGGER trg_blockchain_audit_capture
AFTER INSERT OR UPDATE OR DELETE ON sdedba.cfg_customer_def
FOR EACH ROW
EXECUTE FUNCTION blockchain.audit_capture_trigger();

DROP TRIGGER IF EXISTS trg_blockchain_audit_capture ON sdedba.ref_customer;
CREATE TRIGGER trg_blockchain_audit_capture
AFTER INSERT OR UPDATE OR DELETE ON sdedba.ref_customer
FOR EACH ROW
EXECUTE FUNCTION blockchain.audit_capture_trigger();

DROP TRIGGER IF EXISTS trg_blockchain_audit_capture ON sdedba.ref_customer_misc_info;
CREATE TRIGGER trg_blockchain_audit_capture
AFTER INSERT OR UPDATE OR DELETE ON sdedba.ref_customer_misc_info
FOR EACH ROW
EXECUTE FUNCTION blockchain.audit_capture_trigger();
