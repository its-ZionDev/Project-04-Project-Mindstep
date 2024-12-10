const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path');
const ejs = require('ejs');
const { Client } = require('pg');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

//Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

//Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.json());

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
app.get('/', (req, res) => {
  res.render('Welcome');
});

app.get('/Welcome', (req, res) => {
  res.render('Welcome');
});

app.get('/Synopsis', (req, res) => {
  res.render('Synopsis');
});

app.get('/Read', async (req, res) => {
  try {
    const latestChapterQuery =
      'SELECT * FROM chapterstest ORDER BY created_at DESC LIMIT 1';
    const latestChapterResult = await client.query(latestChapterQuery);
    const latestChapter = latestChapterResult.rows[0];

    const lastUpdatedDate = new Date(
      latestChapter.created_at,
    ).toLocaleDateString();

    res.render('Read', {
      latestChapter,
      lastUpdatedDate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.get('/Book1', async (req, res) => {
  try {
    // Query to fetch the latest chapter
    const latestChapterQuery =
      'SELECT * FROM chapterstest ORDER BY created_at DESC LIMIT 1';
    const latestChapterResult = await client.query(latestChapterQuery);
    const latestChapter = latestChapterResult.rows[0];

    // Query to count total chapters
    const totalChaptersQuery =
      'SELECT COUNT(*) AS total_chapters FROM chapterstest';
    const totalChaptersResult = await client.query(totalChaptersQuery);
    const totalChapters = parseInt(
      totalChaptersResult.rows[0].total_chapters,
      10,
    );

    // Directly get current views for Book1
    const getViewsQuery =
      'SELECT total_views FROM book_views WHERE book_name = $1';
    const getViewsResult = await client.query(getViewsQuery, ['Book1']);

    let totalViews = parseInt(getViewsResult.rows[0].total_views, 10);
    if (isNaN(totalViews)) {
      totalViews = 0;
    }
    totalViews += 1;

    const reviewsResult = await client.query(
      `SELECT COUNT(*) AS total_reviews, COALESCE(AVG(stars), 0) AS average_rating FROM chapterreviews`,
    );
    const { total_reviews, average_rating } = reviewsResult.rows[0];

    // Update the views count in the database
    const updateViewsQuery =
      'UPDATE book_views SET total_views = $1 WHERE book_name = $2';
    const updateResult = await client.query(updateViewsQuery, [
      totalViews,
      'Book1',
    ]);

    // Calculate days ago for the latest chapter
    const daysAgo = Math.floor(
      (Date.now() - new Date(latestChapter.created_at).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const daysAgoText =
      daysAgo === 0 ? 'today' : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;

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

app.get('/Book1_User_Reviews', async (req, res) => {
  try {
    const lastChapterUpdateResult = await client.query(
      `SELECT created_at FROM chapterstest ORDER BY created_at DESC LIMIT 1`,
    );
    const lastChapterUpdate =
      lastChapterUpdateResult.rows[0]?.created_at || 'No updates yet';

    const reviewsResult = await client.query(
      `SELECT COUNT(*) AS total_reviews, COALESCE(AVG(stars), 0) AS average_rating FROM chapterreviews`,
    );
    const { total_reviews, average_rating } = reviewsResult.rows[0];

    // Fetch reviews with all details from chapterreviews table
    const reviewsQuery = `
      SELECT s_no, chapter_no, name, review, stars, likes, created_at 
      FROM chapterreviews 
      ORDER BY created_at DESC
    `;
    const reviewsResultWithLikes = await client.query(reviewsQuery);

    // Map userHasLiked for each review based on cookies
    const reviews = [];
    for (const review of reviewsResultWithLikes.rows) {
      const userHasLiked =
        req.cookies[`liked_review_${review.s_no}`] === 'true';

      // Fetch only replies from the review_replies table based on review_s_no
      const repliesQuery = `
        SELECT id, review_s_no, name, content, likes, created_at
        FROM review_replies 
        WHERE review_s_no = $1
        ORDER BY created_at ASC
      `;
      const repliesResult = await client.query(repliesQuery, [review.s_no]);

      reviews.push({
        ...review,
        userHasLiked,
        replies: repliesResult.rows, // Only review replies should be included
      });
    }

    const chaptersResult = await client.query(
      'SELECT chapter_no, title FROM chapterstest ORDER BY chapter_no',
    );
    const chapters = chaptersResult.rows;

    // Render template with reviews and replies
    res.render('book1_User_Reviews', {
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

app.post('/Book1/reviews', async (req, res) => {
  const { chapter, author, content, stars } = req.body;

  try {
    const result = await client.query(
      `INSERT INTO chapterreviews (chapter_no, parent_id, name, review, stars, likes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [chapter, null, author, content, stars, 0],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving review:', error);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

app.post('/toggle-review-like/:s_no', async (req, res) => {
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
        'UPDATE chapterreviews SET likes = likes - 1 WHERE s_no = $1 RETURNING likes',
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
        'UPDATE chapterreviews SET likes = likes + 1 WHERE s_no = $1 RETURNING likes',
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

app.post('/toggle-review-reply-like/:id', async (req, res) => {
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
        'UPDATE review_replies SET likes = likes - 1 WHERE id = $1 RETURNING likes',
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
        'UPDATE review_replies SET likes = likes + 1 WHERE id = $1 RETURNING likes',
        [id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Reply not found' });
      }

      updatedLikes = result.rows[0].likes;
      res.cookie(cookieKey, 'true', { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 year
    }

    res.json({ success: true, likes: updatedLikes, liked: !hasLiked });
  } catch (error) {
    console.error('Error toggling reply likes:', error);
    res.status(500).json({ success: false, message: 'Error toggling likes.' });
  }
});

app.post('/post-review-reply', async (req, res) => {
  const { review_s_no, parent_id, name, content } = req.body;

  if (!review_s_no || !name || !content) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: review_s_no, name, or content.',
    });
  }

  const reviewSNo = parseInt(review_s_no, 10);
  const parentId = parent_id ? parseInt(parent_id, 10) : null;

  if (isNaN(reviewSNo) || (parentId !== null && isNaN(parentId))) {
    return res.status(400).json({
      success: false,
      message: 'Invalid review_s_no or parent_id.',
    });
  }

  try {
    const insertReplyQuery = `
      INSERT INTO review_replies (review_s_no, parent_id, name, content, created_at) 
      VALUES ($1, $2, $3, $4, NOW()) 
      RETURNING id, review_s_no, parent_id, name, content, created_at
    `;
    const replyResult = await client.query(insertReplyQuery, [
      reviewSNo,
      parentId,
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

app.get('/Book1_Novel_Chapters', async (req, res) => {
  try {
    const allChaptersQuery =
      'SELECT * FROM chapterstest ORDER BY created_at DESC';
    const allChaptersResult = await client.query(allChaptersQuery);

    const allChapters = allChaptersResult.rows.map((chapter) => {
      const daysAgo = Math.floor(
        (Date.now() - new Date(chapter.created_at).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        ...chapter,
        daysAgo:
          daysAgo === 0
            ? 'today'
            : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`,
      };
    });

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

app.get('/Read_Chapter', async (req, res) => {
  const chapterNo = parseInt(req.query.chapter_no, 10);

  if (!chapterNo) {
    return res.status(400).send('Chapter number is required.');
  }

  try {
    const chapterQuery = 'SELECT * FROM chapterstest WHERE chapter_no = $1';
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

    const prevChapterQuery =
      'SELECT chapter_no FROM chapterstest WHERE chapter_no < $1 ORDER BY chapter_no DESC LIMIT 1';
    const nextChapterQuery =
      'SELECT chapter_no FROM chapterstest WHERE chapter_no > $1 ORDER BY chapter_no ASC LIMIT 1';

    const [prevChapterResult, nextChapterResult] = await Promise.all([
      client.query(prevChapterQuery, [chapterNo]),
      client.query(nextChapterQuery, [chapterNo]),
    ]);

    const prevChapterNo = prevChapterResult.rows[0]?.chapter_no || null;
    const nextChapterNo = nextChapterResult.rows[0]?.chapter_no || null;

    const commentsQuery = `
  SELECT * FROM chaptercomments
  WHERE chapter_no = $1
  AND parent_id IS NULL  -- Get only top-level comments
  ORDER BY created_at ASC
`;

    // Fetch Replies (Replies have a parent_id)
    const repliesQuery = `
  SELECT * FROM chaptercomments
  WHERE chapter_no = $1
  AND parent_id IS NOT NULL  -- Get replies
  ORDER BY created_at ASC
`;

    const [commentsResult, repliesResult] = await Promise.all([
      client.query(commentsQuery, [chapterNo]),
      client.query(repliesQuery, [chapterNo]),
    ]);

    // Prepare combined comments structure
    const combinedComments = [];

    // Add top-level comments to combinedComments array
    commentsResult.rows.forEach((comment) => {
      const userHasLiked = req.cookies[`liked_${comment.id}`] === 'true';
      comment.replies = [];
      combinedComments.push({ ...comment, userHasLiked });
    });

    // Add replies with liked status
    repliesResult.rows.forEach((reply) => {
      const userHasLiked = req.cookies[`liked_${reply.id}`] === 'true'; 
      const parentComment = combinedComments.find(
        (comment) => comment.id === reply.parent_id,
      );

      if (parentComment) {
        parentComment.replies.push({ ...reply, userHasLiked }); 
      }
    });

    // Now `combinedComments` contains comments with their replies nested
    // Pass this to the template for rendering
    res.render('Read_Chapter', {
      chapter_no: chapterRow.chapter_no,
      title: chapterRow.title,
      time: chapterRow.created_at,
      synopsis: chapterRow.synopsis,
      chapter: chapterContent,
      prevChapterNo,
      nextChapterNo,
      comments: combinedComments, // Nested comments and replies
    });
  } catch (err) {
    console.error('Error fetching chapter:', err.message);
    res.status(500).send('Error fetching chapter data.');
  }
});

app.post('/post-comment', async (req, res) => {
  const { name, content, chapter_no } = req.body;

  if (!name || !content || !chapter_no) {
    return res
      .status(400)
      .json({ success: false, message: 'All fields are required.' });
  }

  try {
    const result = await client.query(
      'INSERT INTO chaptercomments (name, content, chapter_no) VALUES ($1, $2, $3) RETURNING *',
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

app.post('/toggle-like/:id', async (req, res) => {
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
        'UPDATE chaptercomments SET likes = likes - 1 WHERE id = $1 RETURNING likes',
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
        'UPDATE chaptercomments SET likes = likes + 1 WHERE id = $1 RETURNING likes',
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

app.post('/post-reply', async (req, res) => {
  const { parent_id, name, content, chapter_no } = req.body;

  if (!parent_id || !name || !content || !chapter_no) {
    return res.status(400).json({
      success: false,
      message:
        'Missing required fields: parent_id, name, content, or chapter_no.',
    });
  }

  // Ensure parent_id and chapter_no are integers
  const parentId = parseInt(parent_id, 10);
  const chapterNo = parseInt(chapter_no, 10);

  if (isNaN(parentId) || isNaN(chapterNo)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid parent_id or chapter_no.',
    });
  }

  try {
    // Insert the reply into the database with chapter_no
    const insertReplyQuery = `
      INSERT INTO chaptercomments (parent_id, name, content, chapter_no, created_at) 
      VALUES ($1, $2, $3, $4, NOW()) 
      RETURNING id, parent_id, name, content, chapter_no, created_at
    `;
    const replyResult = await client.query(insertReplyQuery, [
      parentId, // parent_id
      name, // name
      content, // content
      chapterNo, // chapter_no
    ]);

    // Respond with the newly created reply
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

app.get('/Update', async (req, res) => {
  try {
    const result = await client.query(
      'SELECT * FROM community_updates ORDER BY created_at DESC',
    );
    const updates = result.rows.map((update) => {
      update.short_content =
        update.content.length > 100
          ? update.content.slice(0, 100) + '...'
          : update.content;
      return update;
    });
    res.render('Update', { updates });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/toggle-update-like/:s_no', async (req, res) => {
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
        'UPDATE community_updates SET likes = likes - 1 WHERE s_no = $1 RETURNING likes',
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
        'UPDATE community_updates SET likes = likes + 1 WHERE s_no = $1 RETURNING likes',
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

app.get('/Update_News', async (req, res) => {
  const { id } = req.query;

  // Validate the `id` parameter
  if (!id || isNaN(id)) {
    return res.status(400).send('Invalid or missing update identifier');
  }

  try {
    // Fetch the update details from `community_updates`
    const updateResult = await client.query(
      'SELECT s_no, title, image, content FROM community_updates WHERE s_no = $1',
      [id],
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).send('Update not found');
    }

    const update = updateResult.rows[0];

    // Use `id` as `post_id` to fetch comments for this update from `community_updates_comments`
    const commentsResult = await client.query(
      'SELECT post_id, name, content, likes, created_at FROM community_updates_comments WHERE post_id = $1 ORDER BY created_at DESC',
      [id],
    );

    const comments = commentsResult.rows;

    // Render the page with update details and associated comments
    res.render('Update_News', { update, comments });
  } catch (error) {
    console.error('Error fetching update details or comments:', error);
    res
      .status(500)
      .send('Server error while fetching update details or comments.');
  }
});

app.post('/post-update-comment', async (req, res) => {
  const { name, content, post_id } = req.body;

  // Check if the required fields are missing
  if (!name || !content || !post_id) {
    return res
      .status(400)
      .json({ success: false, message: 'All fields are required.' });
  }

  try {
    const result = await client.query(
      'INSERT INTO community_updates_comments (name, content, post_id) VALUES ($1, $2, $3) RETURNING *',
      [name, content, post_id],
    );

    const newComment = result.rows[0];
    res.json({ success: true, comment: newComment });
  } catch (err) {
    console.error('Error posting comment:', err);
    res.status(500).json({ success: false, message: 'Error posting comment' });
  }
});

//Port
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
