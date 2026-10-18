const express = require('express');
function communicationRoutes(db) {
 const r = express.Router();
 r.get('/contacts', (req,res) => res.json(db.prepare('SELECT id,name,role FROM users WHERE id != ? ORDER BY role,name').all(req.user.id)));
 r.get('/threads', (req,res) => {
   const rows=db.prepare(`SELECT m.id,m.sender_id AS senderId,m.recipient_id AS recipientId,m.body,m.created_at AS createdAt, CASE WHEN m.sender_id = ? THEN 1 ELSE 0 END AS isMine,
     u.name AS otherName,u.role AS otherRole,u.id AS otherId FROM messages m
     JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
     WHERE m.sender_id = ? OR m.recipient_id = ? ORDER BY m.id`).all(req.user.id,req.user.id,req.user.id,req.user.id);
   res.json(rows);
 });
 r.post('/',(req,res)=>{
   const {recipientId,body}=req.body||{};
   if(!Number.isInteger(recipientId)||recipientId===req.user.id||!db.prepare('SELECT id FROM users WHERE id = ?').get(recipientId))return res.status(400).json({error:'Choose a valid recipient'});
   if(typeof body!=='string'||!body.trim()||body.trim().length>2000)return res.status(400).json({error:'Message must contain 1–2000 characters'});
   const result=db.prepare('INSERT INTO messages(sender_id,recipient_id,body) VALUES (?,?,?)').run(req.user.id,recipientId,body.trim());
   res.status(201).json({id:Number(result.lastInsertRowid)});
 });
 return r;
}
module.exports={communicationRoutes};
