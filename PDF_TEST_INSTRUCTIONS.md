# PDF Upload Testing Instructions

## Testing PDF Functionality

### 1. Create a Test PDF
To test the PDF upload feature, you can:

**Option A: Create a simple PDF**
1. Open any text editor or word processor
2. Copy and paste this sample recipe:

```
Chocolate Chip Cookies

Ingredients:
- 2 1/4 cups all-purpose flour
- 1 teaspoon baking soda
- 1 teaspoon salt
- 1 cup butter, softened
- 3/4 cup granulated sugar
- 3/4 cup packed brown sugar
- 2 large eggs
- 2 teaspoons vanilla extract
- 2 cups chocolate chips

Instructions:
1. Preheat oven to 375°F (190°C)
2. Mix flour, baking soda, and salt in bowl
3. Beat butter and sugars until creamy
4. Add eggs and vanilla; beat well
5. Gradually blend in flour mixture
6. Stir in chocolate chips
7. Drop rounded tablespoons onto ungreased cookie sheets
8. Bake 9-11 minutes until golden brown
9. Cool on baking sheet 2 minutes; remove to wire rack

Makes about 48 cookies
```

3. Save/export as PDF

**Option B: Use an existing recipe PDF**
- Use any recipe PDF you have
- Make sure it's not password protected
- Text-based PDFs work better than scanned images

### 2. Test the Upload

1. Start the application: `npm run dev`
2. Try uploading your PDF file
3. Watch for progress indicators
4. Check if text is extracted correctly

### 3. Troubleshooting

If PDF upload doesn't work:

1. **Check browser console** for error messages
2. **Try a different PDF** - some PDFs are image-based and won't work
3. **Use alternatives**:
   - Convert PDF to .docx using online tools
   - Copy and paste text directly
   - Save as .txt file

### 4. Expected Behavior

✅ **Working PDF**: Text appears in the recipe text box
❌ **Non-working PDF**: Error message with helpful alternatives

### 5. Fallback Options

The app provides multiple ways to input recipes:
- **Best**: Word documents (.docx)
- **Fastest**: Direct text paste
- **Alternative**: Text files (.txt)
- **Limited**: PDF files (depends on PDF type)

## Common PDF Issues

1. **Scanned PDFs**: Contain images, not text - won't work
2. **Password-protected PDFs**: Cannot be processed
3. **Complex layouts**: May not extract text properly
4. **Large files**: May take longer to process

## Success Indicators

- Progress bar shows during processing
- Status messages update in real-time
- Green checkmark when successful
- Recipe text appears in the text box
