"use strict";

const {roomName}=require(
    "./tasklyAdminPrivateLiveKitV17"
);

function createCleanupService({db,deleteRoom}) {

    if(!db ||
       typeof db.query!=="function" ||
       typeof deleteRoom!=="function"){
        throw new TypeError("Cleanup dependencies required");
    }

    async function sweep(limit=25){

        if(!Number.isInteger(limit) ||
           limit<1 || limit>100){
            throw new RangeError("Invalid cleanup limit");
        }

        // Expire calls even if users have left the site.
        await db.query(
            `UPDATE taskly_admin_private_calls
             SET state=CASE
                 WHEN state='ringing' THEN 'missed'
                 ELSE 'ended'
             END,
             updated_at=UTC_TIMESTAMP(3)
             WHERE state IN ('ringing','accepted')
               AND expires_at<=UTC_TIMESTAMP(3)
             LIMIT 100`
        );

        // Only terminal V17 calls may be cleaned.
        const [rows]=await db.query(
            `SELECT id,
                    CAST(thread_id AS CHAR) AS thread_id,
                    cleanup_stage
             FROM taskly_admin_private_calls
             WHERE state IN (
                'missed','ended','cancelled','rejected'
             )
               AND cleanup_stage IN (0,1)
               AND (
                   cleanup_next_at IS NULL OR
                   cleanup_next_at<=UTC_TIMESTAMP(3)
               )
             ORDER BY updated_at,id
             LIMIT ?`,
            [limit]
        );

        const result={
            processed:0,
            succeeded:0,
            failed:0
        };

        for(const row of rows){

            const stage=Number(row.cleanup_stage);

            if(![0,1].includes(stage)){
                throw new Error("Invalid cleanup stage");
            }

            const room=roomName(row.thread_id,row.id);

            result.processed++;

            try{
                // Adapter must treat room not found
                // as a successful, idempotent deletion.
                await deleteRoom(room);

            }catch{
                // Persist retry. Do not expose secrets.
                await db.query(
                    `UPDATE taskly_admin_private_calls
                     SET cleanup_next_at=DATE_ADD(
                         UTC_TIMESTAMP(3),
                         INTERVAL 30 SECOND
                     )
                     WHERE id=?
                       AND cleanup_stage=?`,
                    [row.id,stage]
                );

                result.failed++;
                continue;
            }

            const nextStage=stage+1;

            // First close now. Second close after
            // the initial token validity window.
            await db.query(
                `UPDATE taskly_admin_private_calls
                 SET cleanup_stage=?,
                     cleanup_next_at=CASE
                         WHEN ?=1 THEN DATE_ADD(
                             UTC_TIMESTAMP(3),
                             INTERVAL 3 MINUTE
                         )
                         ELSE NULL
                     END
                 WHERE id=?
                   AND cleanup_stage=?
                   AND state IN (
                       'missed','ended',
                       'cancelled','rejected'
                   )`,
                [nextStage,nextStage,row.id,stage]
            );

            result.succeeded++;
        }

        return result;
    }

    return {sweep};
}

module.exports={createCleanupService};