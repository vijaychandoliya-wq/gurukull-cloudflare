// Password changes intentionally cancel old credential messages. They are not
// provider failures and must not keep the delivery monitor permanently red.
export const deliveryHealthQuery="SELECT SUM(CASE WHEN ((status='pending' AND created_at<unixepoch()-900) OR (status='processing' AND lease_until<=unixepoch())) THEN 1 ELSE 0 END) AS delayed,SUM(CASE WHEN status='dead_letter' AND COALESCE(last_error,'') NOT IN ('Credential replaced by account owner','Credential replaced by administrator') THEN 1 ELSE 0 END) AS held FROM outbox WHERE status IN ('pending','processing','dead_letter')";
