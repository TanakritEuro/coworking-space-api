const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

//@desc     Register user
//@route    POST /api/v1/auth/register
//@access   Public
exports.register = async (req, res, next) => {
    try {
        //role is deliberately not read from the body: self-registered users are always 'user'
        const { name, tel, email, password } = req.body;

        //Create user
        const user = await User.create({
            name,
            tel,
            email,
            password
        });

        //Create token
        sendTokenResponse(user, 201, res);
    } catch (err) {
        res.status(400).json({ success: false });
        console.log(err.stack);
    }
};

//@desc     Login user
//@route    POST /api/v1/auth/login
//@access   Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        //Validate email & password
        if (!email || !password) {
            return res.status(400).json({ success: false, msg: 'Please provide an email and password' });
        }

        //Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(400).json({ success: false, msg: 'Invalid credentials' });
        }

        //Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, msg: 'Invalid credentials' });
        }

        //Create token
        sendTokenResponse(user, 200, res);
    } catch (err) {
        console.log(err.stack);
        return res.status(401).json({ success: false, msg: 'Cannot convert email or password to string' });
    }
};

//@desc     Get current logged in user
//@route    GET /api/v1/auth/me
//@access   Private
exports.getMe = async (req, res, next) => {
    const user = await User.findById(req.user.id);
    res.status(200).json({
        success: true,
        data: user
    });
};

//@desc     Log user out / clear cookie
//@route    GET /api/v1/auth/logout
//@access   Private
exports.logout = async (req, res, next) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });

    res.status(200).json({
        success: true,
        data: {}
    });
};

//@desc     Request a password reset link
//@route    POST /api/v1/auth/forgotpassword
//@access   Public
exports.forgotPassword = async (req, res, next) => {
    //Same answer whether or not the email is registered, so the API cannot be used to discover accounts
    const genericResponse = { success: true, message: 'If that email is registered, a password reset link has been sent' };

    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ success: false, message: 'Please provide an email' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json(genericResponse);
        }

        //A new request replaces any earlier unused token
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        const clientUrl = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}/api/v1/auth`;
        const resetUrl = `${clientUrl}/resetpassword/${resetToken}`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password reset request',
                message: `You requested a password reset.\n\nUse this link within 15 minutes to set a new password:\n${resetUrl}\n\nThe link works only once. If you did not request this, you can ignore this email.`
            });
        } catch (err) {
            console.log(err.stack);
            //Do not leave a token nobody received
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }

        res.status(200).json(genericResponse);
    } catch (err) {
        console.log(err.stack);
        res.status(500).json({ success: false, message: 'Cannot process password reset request' });
    }
};

//@desc     Set a new password with a reset token
//@route    PUT /api/v1/auth/resetpassword/:resettoken
//@access   Public
exports.resetPassword = async (req, res, next) => {
    try {
        const { password } = req.body;

        if (!password || typeof password !== 'string') {
            return res.status(400).json({ success: false, message: 'Please provide a new password' });
        }

        //Compare by hash; an expired token never matches
        const resetPasswordToken = crypto.createHash('sha256').update(String(req.params.resettoken)).digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
        }

        //Setting the password triggers hashing; clearing the fields makes the token single-use
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Password has been reset. Please log in with the new password' });
    } catch (err) {
        //Validation errors (e.g. password shorter than 6) leave the token usable
        if (err.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: Object.values(err.errors).map(e => e.message).join(', ') });
        }
        console.log(err.stack);
        res.status(500).json({ success: false, message: 'Cannot reset password' });
    }
};

//Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
    //Create token
    const token = user.getSignedJwtToken();

    const options = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true
    };

    if (process.env.NODE_ENV === 'production') {
        options.secure = true;
    }

    res.status(statusCode).cookie('token', token, options).json({
        success: true,
        token
    });
};