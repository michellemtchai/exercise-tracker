// setup express
const express = require('express');
const router = express.Router();

// setup bodyParser
const bodyParser = require('body-parser');
router.use(
  bodyParser.urlencoded({
    extended: false,
  }),
);

// setup mongoose
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
});

// setup schema and model
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
});
const exerciseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  date: Date,
});
const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

const validDate = (date) => {
  const regex = /^[0-9]{4}\-[0-1][0-9]\-[0-3][0-9]$/;
  return date ? Array.isArray(date.match(regex)) : false;
};
const validInt = (num) => {
  const regex = /^[0-9]+$/;
  return num ? Array.isArray(num.match(regex)) : false;
};
const invalidDate = 'Invalid date format. Need to be yyyy-mm-dd';
const invalidDuration = 'Invalid duration type. Must be an int.';
const invalidUsername = 'Username already taken.';
const invalidUserId = 'Invalid userId.';
const maxDate = new Date(8640000000000000);
const minDate = new Date(-8640000000000000);

// create db functions
const createAndSaveUser = (username, done) => {
  let user = new User({
    username: username,
  });
  user.save((err, data) => {
    if (err)
      return done({
        message: invalidUsername,
      });
    User.findById(data._id)
      .select({
        __v: 0,
      })
      .exec((err, data) => {
        if (err) return done(err);
        done(null, data);
      });
  });
};
const getAllUsers = (done) => {
  User.find({}, (err, data) => {
    if (err) return done(err);
    done(null, data);
  });
};
const addExercise = (userData, done) => {
  let exercise = new Exercise({
    userId: userData.userId,
    description: userData.description,
    duration: parseInt(userData.duration),
    date: validDate(userData.date) ? new Date(userData.date) : new Date(),
  });
  let deleteEntry = false;
  exercise.save(async (err, exerciseData) => {
    if (err) {
      await exercise.remove();
      return done(err);
    }
    User.findById(exerciseData.userId, async (err, data) => {
      if (!data) {
        await exercise.remove();
        return done(err);
      }
      done(null, {
        _id: data._id,
        username: data.username,
        date: exerciseData.date.toDateString(),
        duration: exerciseData.duration,
        description: exerciseData.description,
      });
    });
  });
};
const getExercises = (userData, done) => {
  let limit = validInt(userData.limit) ? parseInt(userData.limit) : 0;
  let fromDate = validDate(userData.from) ? new Date(userData.from) : minDate;
  let toDate = validDate(userData.to) ? new Date(userData.to) : maxDate;

  User.findById(userData.userId, (err, data) => {
    if (err) return done({ message: invalidUserId });
    Exercise.find({
      userId: data._id,
      date: { $lte: toDate, $gte: fromDate },
    })
      .sort({
        date: 1,
      })
      .limit(limit)
      .exec((err, exerciseData) => {
        if (err) return done({ message: invalidUserId });
        let logs = exerciseData.map((i) => ({
          description: i.description,
          duration: i.duration,
          date: i.date.toDateString(),
        }));
        done(null, {
          _id: data._id,
          username: data.username,
          count: limit == 0 ? exerciseData.length : limit,
          log: logs,
        });
      });
  });
};

let t;
const timeout = 10000;
const timeoutFn = (next) => {
  return setTimeout(() => {
    next({
      message: 'timeout',
    });
  }, timeout);
};
const handleResult = (res, next, err, data) => {
  clearTimeout(t);
  if (err) {
    return next(err);
  }
  if (!data) {
    console.log('Missing `done()` argument');
    return next({ message: 'Missing callback argument' });
  } else {
    res.json(data);
  }
};

// define routes
router.get('/exercise/users', (req, res, next) => {
  t = timeoutFn(next);
  getAllUsers((err, data) => {
    handleResult(res, next, err, data);
  });
});
router.get('/exercise/log', (req, res, next) => {
  if (req.query.userId) {
    t = timeoutFn(next);
    getExercises(req.query, (err, data) => {
      handleResult(res, next, err, data);
    });
  } else {
    next({ message: invalidUserId });
  }
});
router.post('/exercise/new-user', (req, res, next) => {
  t = timeoutFn(next);
  createAndSaveUser(req.body.username, (err, data) => {
    handleResult(res, next, err, data);
  });
});
router.post('/exercise/add', (req, res, next) => {
  t = timeoutFn(next);
  if (!validInt(req.body.duration)) {
    next({ message: invalidDuration });
  }
  if (req.body.date) {
    if (!validDate(req.body.date)) next({ message: invalidDate });
  }
  addExercise(req.body, (err, data) => {
    handleResult(res, next, err, data);
  });
});
//---------- DO NOT EDIT BELOW THIS LINE --------------------

module.exports = router;
