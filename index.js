const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const ejs = require('ejs');
const { Client } = require('pg');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

//Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json());
app.use((req, res, next) => {
  res.locals.metaTitle = 'Project Mindstep';
  res.locals.metaDescription = 'When he was six years old, Asher Nephesh lost nearly everything—his parents, his home, and even his memories. All that remains are two people he holds close to his heart: his chaotic best friend, Takashi Hoso, and the ever-gentle Fleur Bellerose. But when Asher is drawn into a mysterious dreamscape, he begins to uncover unsettling truths—memories buried not just by time, but by intention…';
  res.locals.metaImage = 'https://res.cloudinary.com/dwjs1spfk/image/upload/v1734987286/Mindstep_Cover_mzds3e.png';
  res.locals.metaUrl = `https://readprojectmindstep.online${req.originalUrl}`;
  next();
});

//Database Connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Connect to the PostgreSQL database
client.connect((err) => {
  if (err) {
    console.error('Error connecting to the database', err.stack);
  } else {
    console.log('Connected to the database');
  }
});

//Routes

//Welcome
app.get('/', (req, res) => {
  res.render('Welcome');
});

app.get('/welcome', (req, res) => {
  res.render('Welcome');
});

//Synopsis
app.get('/synopsis', (req, res) => {
  res.render('Synopsis');
});

//Read
app.get('/read', async (req, res) => {
  try {
    const latestChapterQuery = 'SELECT * FROM book1_chapters ORDER BY created_at DESC LIMIT 1';
    const latestChapterResult = await client.query(latestChapterQuery);
    const latestChapter = latestChapterResult.rows[0];

    const lastUpdatedDate = new Date(latestChapter.created_at,).toLocaleDateString();

    res.render('Read', {
      latestChapter,
      lastUpdatedDate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

//Book-1
app.get('/book1', async (req, res) => {
  try {
    const latestChapterQuery = 'SELECT * FROM book1_chapters ORDER BY created_at DESC LIMIT 1';
    const latestChapterResult = await client.query(latestChapterQuery);
    const latestChapter = latestChapterResult.rows[0];

    const totalChaptersQuery = 'SELECT COUNT(*) AS total_chapters FROM book1_chapters';
    const totalChaptersResult = await client.query(totalChaptersQuery);
    const totalChapters = parseInt(totalChaptersResult.rows[0].total_chapters, 10,);

    const getViewsQuery = 'SELECT total_views FROM book_views WHERE book_name = $1';
    const getViewsResult = await client.query(getViewsQuery, ['Book1']);

    let totalViews = parseInt(getViewsResult.rows[0].total_views, 10);
    if (isNaN(totalViews)) {
      totalViews = 0;
    }
    totalViews += 1;

    const reviewsResult = await client.query(`SELECT COUNT(*) AS total_reviews, COALESCE(AVG(stars), 0) AS average_rating FROM book1_reviews`,);
    const { total_reviews, average_rating } = reviewsResult.rows[0];

    const getRelativeTime = (createdAt) => {
      const now = Date.now();
      const daysAgo = Math.floor((now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo === 0) return 'today';
      if (daysAgo === 1) return 'yesterday';
      if (daysAgo < 30) return `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
      const monthsAgo = Math.floor(daysAgo / 30);
      if (monthsAgo < 12) return `${monthsAgo} month${monthsAgo > 1 ? 's' : ''} ago`;
      const yearsAgo = Math.floor(monthsAgo / 12);
      return `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago`;
    };

    const daysAgoText = getRelativeTime(latestChapter.created_at);

    res.render('Book1', {
      totalChapters,
      latestChapter,
      daysAgoText,
      totalViews,
      totalReviews: total_reviews,
      averageRating: parseFloat(average_rating).toFixed(1),
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Server error');
  }
});

//Book-1 - User Reviews
app.get('/book1_user_reviews', async (req, res) => {
  try {
    const lastChapterUpdateResult = await client.query(`SELECT created_at FROM book1_chapters ORDER BY created_at DESC LIMIT 1`,);
    const lastChapterUpdate = lastChapterUpdateResult.rows[0]?.created_at || 'No updates yet';

    const reviewsResult = await client.query(`SELECT COUNT(*) AS total_reviews, COALESCE(AVG(stars), 0) AS average_rating FROM book1_reviews`,);
    const { total_reviews, average_rating } = reviewsResult.rows[0];

    const reviewsQuery = `SELECT s_no, chapter_no, name, review, stars, likes, created_at FROM book1_reviews ORDER BY created_at DESC`;
    const reviewsResultWithLikes = await client.query(reviewsQuery);

    const reviews = [];
    for (const review of reviewsResultWithLikes.rows) {
      const userHasLiked =
        req.cookies[`liked_review_${review.s_no}`] === 'true';

      const repliesQuery = `SELECT id, review_s_no, name, content, likes, created_at FROM book1_reviews_comments WHERE review_s_no = $1 ORDER BY created_at ASC`;
      const repliesResult = await client.query(repliesQuery, [review.s_no]);

      reviews.push({
        ...review,
        userHasLiked,
        replies: repliesResult.rows,
      });
    }

    const chaptersResult = await client.query('SELECT chapter_no, title FROM book1_chapters ORDER BY chapter_no',);
    const chapters = chaptersResult.rows;

    res.render('Book1_User_Reviews', {
      lastChapterUpdate,
      totalReviews: total_reviews,
      averageRating: parseFloat(average_rating).toFixed(1),
      reviews,
      chapters,
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/book1/reviews', async (req, res) => {
  const { chapter, author, content, stars } = req.body;

  try {
    const result = await client.query(
      `INSERT INTO book1_reviews (chapter_no, name, review, stars, likes, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [chapter, author, content, stars, 0],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving review:', error);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

app.post('/book1/reviews/like/:s_no', async (req, res) => {
  const { s_no } = req.params;

  if (!s_no || isNaN(s_no)) {
    return res.json({ success: false, message: 'Invalid review identifier' });
  }

  const cookieKey = `liked_review_${s_no}`;
  const hasLiked = req.cookies[cookieKey];

  try {
    let updatedLikes;

    if (hasLiked) {
      const result = await client.query(
        'UPDATE book1_reviews SET likes = likes - 1 WHERE s_no = $1 RETURNING likes',
        [s_no],
      );

      if (result.rows.length === 0) {
        return res.json({
          success: false,
          message: 'Review not found',
        });
      }

      updatedLikes = result.rows[0].likes;
      res.clearCookie(cookieKey);
    } else {
      const result = await client.query(
        'UPDATE book1_reviews SET likes = likes + 1 WHERE s_no = $1 RETURNING likes',
        [s_no],
      );

      if (result.rows.length === 0) {
        return res.json({
          success: false,
          message: 'Review not found',
        });
      }

      updatedLikes = result.rows[0].likes;
      res.cookie(cookieKey, 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 });
    }

    res.json({ success: true, likes: updatedLikes, liked: !hasLiked });
  } catch (error) {
    console.error('Error toggling review likes:', error);
    res.json({ success: false, message: 'Error toggling likes.' });
  }
});

app.post('/book1/reviews/reply', async (req, res) => {
  const { review_s_no, name, content } = req.body;

  if (!review_s_no || !name || !content) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: review_s_no, name, or content.',
    });
  }

  const reviewSNo = parseInt(review_s_no, 10);

  if (isNaN(reviewSNo)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid review_s_no',
    });
  }

  try {
    const insertReplyQuery = `
      INSERT INTO book1_reviews_comments (review_s_no, name, content, created_at) 
      VALUES ($1, $2, $3, NOW()) 
      RETURNING id, review_s_no, name, content, created_at
    `;
    const replyResult = await client.query(insertReplyQuery, [
      reviewSNo,
      name,
      content,
    ]);

    const newReply = replyResult.rows[0];
    return res.status(200).json({
      success: true,
      reply: newReply,
    });
  } catch (error) {
    console.error('Error posting review reply:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error posting review reply. Please try again later.',
    });
  }
});

app.post('/book1/reviews/reply/like/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid reply identifier' });
  }

  const cookieKey = `liked_reply_${id}`;
  const hasLiked = req.cookies[cookieKey];

  try {
    let updatedLikes;

    if (hasLiked) {
      const result = await client.query(
        'UPDATE book1_reviews_comments SET likes = likes - 1 WHERE id = $1 RETURNING likes',
        [id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Reply not found' });
      }

      updatedLikes = result.rows[0].likes;
      res.clearCookie(cookieKey);
    } else {
      const result = await client.query(
        'UPDATE book1_reviews_comments SET likes = likes + 1 WHERE id = $1 RETURNING likes',
        [id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Reply not found' });
      }

      updatedLikes = result.rows[0].likes;
      res.cookie(cookieKey, 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 }); 
    }

    res.json({ success: true, likes: updatedLikes, liked: !hasLiked });
  } catch (error) {
    console.error('Error toggling reply likes:', error);
    res.status(500).json({ success: false, message: 'Error toggling likes.' });
  }
});

//Book-1 - Novel Chapters List
app.get('/book1_novel_chapters', async (req, res) => {
  try {
    const allChaptersQuery = 'SELECT * FROM book1_chapters ORDER BY created_at DESC';
    const allChaptersResult = await client.query(allChaptersQuery);

    const getRelativeTime = (createdAt) => {
      const now = Date.now();
      const daysAgo = Math.floor(
        (now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysAgo === 0) return 'today';
      if (daysAgo === 1) return 'yesterday';
      if (daysAgo < 30) return `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
      const monthsAgo = Math.floor(daysAgo / 30);
      if (monthsAgo < 12)
        return `${monthsAgo} month${monthsAgo > 1 ? 's' : ''} ago`;
      const yearsAgo = Math.floor(monthsAgo / 12);
      return `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago`;
    };

    const allChapters = allChaptersResult.rows.map((chapter) => ({
      ...chapter,
      daysAgo: getRelativeTime(chapter.created_at),
    }));

    allChapters.reverse();

    const totalChapters = allChapters.length;
    const latestChapter = allChapters[allChapters.length - 1];
    res.render('Book1_Novel_Chapters', {
      allChapters,
      totalChapters,
      latestChapter,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

//Book-1 - Read Novel Chapter
app.get('/read_chapter', async (req, res) => {
  const chapterNo = parseInt(req.query.chapter_no, 10);

  if (chapterNo === null || chapterNo === undefined || isNaN(chapterNo)) {
    return res.status(400).send('Chapter number is required.');
  }

  try {
    const chapterQuery = 'SELECT * FROM book1_chapters WHERE chapter_no = $1';
    const chapterResult = await client.query(chapterQuery, [chapterNo]);

    if (chapterResult.rows.length === 0) {
      return res.status(404).send('Chapter not found.');
    }

    const chapterRow = chapterResult.rows[0];
    let chapterContent = chapterRow.chapter;

    if (typeof chapterContent === 'string') {
      try {
        chapterContent = JSON.parse(chapterContent);
      } catch (err) {
        console.error('Failed to parse chapter content:', err.message);
        chapterContent = {};
      }
    }

    const prevChapterQuery = 'SELECT chapter_no FROM book1_chapters WHERE chapter_no < $1 ORDER BY chapter_no DESC LIMIT 1';
    const nextChapterQuery = 'SELECT chapter_no FROM book1_chapters WHERE chapter_no > $1 ORDER BY chapter_no ASC LIMIT 1';

    const [prevChapterResult, nextChapterResult] = await Promise.all([
      client.query(prevChapterQuery, [chapterNo]),
      client.query(nextChapterQuery, [chapterNo]),
    ]);

    const prevChapterNo = prevChapterResult.rows[0]?.chapter_no || null;
    const nextChapterNo = nextChapterResult.rows[0]?.chapter_no || null;

    const commentsQuery = `SELECT * FROM book1_comments WHERE chapter_no = $1 AND parent_id IS NULL ORDER BY created_at ASC`;
    const repliesQuery =  `SELECT * FROM book1_comments WHERE chapter_no = $1 AND parent_id IS NOT NULL ORDER BY created_at ASC`;

    const [commentsResult, repliesResult] = await Promise.all([
      client.query(commentsQuery, [chapterNo]),
      client.query(repliesQuery, [chapterNo]),
    ]);

    const combinedComments = [];

    commentsResult.rows.forEach((comment) => {
      const userHasLiked = req.cookies[`liked_${comment.id}`] === 'true';
      comment.replies = [];
      combinedComments.push({ ...comment, userHasLiked });
    });

    repliesResult.rows.forEach((reply) => {
      const userHasLiked = req.cookies[`liked_${reply.id}`] === 'true';
      const parentComment = combinedComments.find(
        (comment) => comment.id === reply.parent_id,
      );

      if (parentComment) {
        parentComment.replies.push({ ...reply, userHasLiked });
      }
    });

    res.render('Read_Chapter', {
      chapter_no: chapterRow.chapter_no,
      title: chapterRow.title,
      time: chapterRow.created_at,
      synopsis: chapterRow.synopsis,
      chapter: chapterContent,
      prevChapterNo,
      nextChapterNo,
      comments: combinedComments,
      metaTitle: `${chapterRow.title} - Project Mindstep`,
      metaDescription: chapterRow.synopsis,
      metaImage: chapterRow.image,
      metaUrl: `https://readprojectmindstep.online/read_chapter?chapter_no=${chapterRow.chapter_no}`,
    });
  } catch (err) {
    console.error('Error fetching chapter:', err.message);
    res.status(500).send('Error fetching chapter data.');
  }
});

app.post('/read_chapter/comment', async (req, res) => {
  const { name, content, chapter_no } = req.body;

  if (!name || !content || !chapter_no) {
    return res
      .status(400)
      .json({ success: false, message: 'All fields are required.' });
  }

  try {
    const result = await client.query(
      'INSERT INTO book1_comments (name, content, chapter_no) VALUES ($1, $2, $3) RETURNING *',
      [name, content, chapter_no],
    );

    const newComment = result.rows[0];

    res.json({
      success: true,
      comment: newComment,
    });
  } catch (err) {
    console.error('Error posting comment:', err);
    res.status(500).json({ success: false, message: 'Error posting comment' });
  }
});

app.post('/read_chapter/reply', async (req, res) => {
  const { parent_id, name, content, chapter_no } = req.body;

  if (!parent_id || !name || !content || !chapter_no) {
    return res.status(400).json({
      success: false,
      message:
        'Missing required fields: parent_id, name, content, or chapter_no.',
    });
  }

  const parentId = parseInt(parent_id, 10);
  const chapterNo = parseInt(chapter_no, 10);

  if (isNaN(parentId) || isNaN(chapterNo)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid parent_id or chapter_no.',
    });
  }

  try {
    const insertReplyQuery = `
      INSERT INTO book1_comments (parent_id, name, content, chapter_no, created_at) 
      VALUES ($1, $2, $3, $4, NOW()) 
      RETURNING id, parent_id, name, content, chapter_no, created_at
    `;
    const replyResult = await client.query(insertReplyQuery, [
      parentId,
      name,
      content,
      chapterNo,
    ]);

    const newReply = replyResult.rows[0];
    return res.status(200).json({
      success: true,
      reply: newReply,
    });
  } catch (error) {
    console.error('Error posting reply:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error posting reply. Please try again later.',
    });
  }
});

app.post('/read_chapter/like/:id', async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.json({ success: false, message: 'Invalid ID' });
  }

  const cookieKey = `liked_${id}`;
  const hasLiked = req.cookies[cookieKey];

  try {
    let updatedLikes;

    if (hasLiked) {
      const result = await client.query(
        'UPDATE book1_comments SET likes = likes - 1 WHERE id = $1 RETURNING likes',
        [id],
      );

      if (result.rows.length === 0) {
        return res.json({
          success: false,
          message: 'Comment or reply not found',
        });
      }

      updatedLikes = result.rows[0].likes;
      res.clearCookie(cookieKey);
    } else {
      const result = await client.query(
        'UPDATE book1_comments SET likes = likes + 1 WHERE id = $1 RETURNING likes',
        [id],
      );

      if (result.rows.length === 0) {
        return res.json({
          success: false,
          message: 'Comment or reply not found',
        });
      }

      updatedLikes = result.rows[0].likes;
      res.cookie(cookieKey, 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 });
    }

    res.json({ success: true, likes: updatedLikes, liked: !hasLiked });
  } catch (error) {
    console.error('Error toggling likes:', error);
    res.json({ success: false, message: 'Error toggling likes.' });
  }
});

//Update
app.get('/update', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM com_updates ORDER BY created_at DESC',);

    const updates = result.rows.map((update) => {
      const userHasLiked =
        req.cookies[`liked_update_${update.s_no}`] === 'true';
      update.short_content =
        update.content.length > 100
          ? update.content.slice(0, 100) + '...'
          : update.content;

      return {
        ...update,
        userHasLiked,
      };
    });

    res.render('Update', { updates });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/update/like/:s_no', async (req, res) => {
  const { s_no } = req.params;

  if (!s_no || isNaN(s_no)) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid update identifier' });
  }

  const cookieKey = `liked_update_${s_no}`;
  const hasLiked = req.cookies[cookieKey];

  try {
    let updatedLikes;

    if (hasLiked) {
      const result = await client.query(
        'UPDATE com_updates SET likes = likes - 1 WHERE s_no = $1 RETURNING likes',
        [s_no],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Update not found' });
      }

      updatedLikes = result.rows[0].likes;
      res.clearCookie(cookieKey);
    } else {
      const result = await client.query(
        'UPDATE com_updates SET likes = likes + 1 WHERE s_no = $1 RETURNING likes',
        [s_no],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Update not found' });
      }

      updatedLikes = result.rows[0].likes;
      res.cookie(cookieKey, 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 year
    }

    res.json({ success: true, likes: updatedLikes, liked: !hasLiked });
  } catch (error) {
    console.error('Error toggling update likes:', error);
    res.status(500).json({ success: false, message: 'Error toggling likes.' });
  }
});

//Update News
app.get('/update_news', async (req, res) => {
  const { id } = req.query;

  if (!id || isNaN(id)) {
    return res.status(400).send('Invalid or missing update identifier');
  }

  try {
    const updateResult = await client.query(
      'SELECT s_no, title, image, content FROM com_updates WHERE s_no = $1',
      [id],
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).send('Update not found');
    }

    const update = updateResult.rows[0];

    const commentsResult = await client.query(
      'SELECT s_no, post_id, name, content, likes, created_at FROM com_updates_comments WHERE post_id = $1 ORDER BY created_at DESC',
      [id],
    );

    const comments = commentsResult.rows.map((comment) => {
      const userHasLiked = req.cookies[`liked_post_${comment.s_no}`] === 'true';
      return { ...comment, userHasLiked };
    });

    res.render('Update_News', { update, comments });
  } catch (error) {
    console.error('Error fetching update details or comments:', error);
    res
      .status(500)
      .send('Server error while fetching update details or comments.');
  }
});

app.post('/update_news/comment', async (req, res) => {
  const { name, content, post_id } = req.body;

  if (!name || !content || !post_id) {
    return res
      .status(400)
      .json({ success: false, message: 'All fields are required.' });
  }

  try {
    const result = await client.query(
      'INSERT INTO com_updates_comments (name, content, post_id) VALUES ($1, $2, $3) RETURNING *',
      [name, content, post_id],
    );

    const newComment = result.rows[0];
    res.json({ success: true, comment: newComment });
  } catch (err) {
    console.error('Error posting comment:', err);
    res.status(500).json({ success: false, message: 'Error posting comment' });
  }
});

app.post('/update_news/like/:commentId', async (req, res) => {
  const { commentId } = req.params;

  if (!commentId || isNaN(commentId)) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid comment ID' });
  }

  try {
    const likeResult = await client.query(
      'SELECT likes FROM com_updates_comments WHERE s_no = $1',
      [commentId],
    );

    if (likeResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Comment not found' });
    }

    const currentLikes = likeResult.rows[0].likes || 0;

    const userHasLiked = req.cookies[`liked_comment_${commentId}`] === 'true';

    let updatedLikes;
    if (userHasLiked) {
      updatedLikes = currentLikes - 1;
      res.clearCookie(`liked_comment_${commentId}`);
    } else {
      updatedLikes = currentLikes + 1;
      res.cookie(`liked_comment_${commentId}`, true, { httpOnly: true });
    }

    await client.query(
      'UPDATE com_updates_comments SET likes = $1 WHERE s_no = $2',
      [updatedLikes, commentId],
    );

    res.json({ success: true, likes: updatedLikes, liked: !userHasLiked });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ success: false, message: 'Error toggling like' });
  }
});

//Port
app.listen(port, () => {
  console.log(`Server is in production mode and running on port:${port}`);
});
