const { dbHelper } = require('../config/db');

const notificationController = {
  async getNotifications(req, res) {
    try {
      const user = req.user;
      const notifications = await dbHelper.all(`
        SELECT * FROM notifications 
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 30
      `, [user.id]);

      const unread = await dbHelper.get(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_status = 0",
        [user.id]
      );

      res.json({
        notifications,
        unreadCount: unread ? unread.count : 0
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to retrieve notifications.' });
    }
  },

  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;

      await dbHelper.run(
        "UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ?",
        [id, user.id]
      );

      res.json({ message: 'Notification marked as read.' });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ error: 'Failed to update notification.' });
    }
  },

  async markAllAsRead(req, res) {
    try {
      const user = req.user;

      await dbHelper.run(
        "UPDATE notifications SET read_status = 1 WHERE user_id = ?",
        [user.id]
      );

      res.json({ message: 'All notifications marked as read.' });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({ error: 'Failed to update notifications.' });
    }
  },

  async clearNotifications(req, res) {
    try {
      const user = req.user;
      await dbHelper.run("DELETE FROM notifications WHERE user_id = ?", [user.id]);
      res.json({ message: 'Notifications cleared.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear notifications.' });
    }
  }
};

module.exports = notificationController;
