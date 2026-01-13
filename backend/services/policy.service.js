const supabase = require('../config/supabase');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const createDOMPurify = require('isomorphic-dompurify');
const logger = require('../utils/logger');

const DOMPurify = createDOMPurify;

class PolicyService {
    async normalizeHtml(html) {
        // Sanitize using allowlist
        const sanitized = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'table', 'thead', 'tbody', 'tr', 'td'],
            ALLOWED_ATTR: ['href', 'target'],
        });

        // Clean up multiple <br> tags
        let normalized = sanitized.replace(/(<br\s*\/?>){2,}/gi, '<br>');

        // Extra cleaning for PDF artifacts (like "Page 1 of 5" or common footer patterns)
        normalized = normalized.replace(/Page \d+ of \d+/gi, '');

        return normalized;
    }

    async parseDocument(buffer, mimetype) {
        try {
            if (mimetype === 'application/pdf') {
                const data = await pdf(buffer);
                let text = data.text || '';

                // Remove null characters
                text = text.replace(/\0/g, '');

                // Basic PDF to Semantic HTML logic
                // 1. Detect all-caps lines or short lines as headings
                // 2. Detect bullet points
                const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                let html = '';
                let inList = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];

                    // List item detection (starting with bullet points or dashes)
                    if (/^[\u2022\u00B7\u25CF\-\*]\s+/.test(line)) {
                        if (!inList) {
                            html += '<ul>';
                            inList = true;
                        }
                        html += `<li>${line.replace(/^[\u2022\u00B7\u25CF\-\*]\s+/, '')}</li>`;
                        continue;
                    }

                    if (inList) {
                        html += '</ul>';
                        inList = false;
                    }

                    // Heading detection (all caps or starting with a number like "1. Section")
                    if (/^[A-Z0-9\s\.\:\-]+$/.test(line) && line.length < 100) {
                        // Determine heading level by length or numbering
                        if (/^\d+\./.test(line)) {
                            html += `<h2>${line}</h2>`;
                        } else {
                            html += `<h3>${line}</h3>`;
                        }
                    } else {
                        html += `<p>${line}</p>`;
                    }
                }

                if (inList) html += '</ul>';

                return this.normalizeHtml(html);
            } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimetype === 'application/msword') {
                const options = {
                    styleMap: [
                        "p[style-name='Title'] => h1:fresh",
                        "p[style-name='Heading 1'] => h2:fresh",
                        "p[style-name='Heading 2'] => h3:fresh",
                        "p[style-name='Normal'] => p:fresh",
                        "r[style-name='Strong'] => strong"
                    ]
                };
                const result = await mammoth.convertToHtml({ buffer }, options);
                return this.normalizeHtml(result.value);
            } else {
                throw new Error('Unsupported file type');
            }
        } catch (error) {
            logger.error({ err: error }, 'Error parsing document');
            throw new Error('Failed to parse document content: ' + error.message);
        }
    }

    async uploadPolicy(file, policyType, title, userId) {
        // 1. Upload to Supabase Storage
        const fileExt = file.originalname.split('.').pop().toLowerCase();
        const filePath = `${policyType}/${Date.now()}_${file.originalname}`;

        const { error: uploadError } = await supabase.storage
            .from('policy-documents')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            logger.error({ err: uploadError }, 'Supabase storage upload failed');
            throw new Error(`Failed to upload to storage: ${uploadError.message}`);
        }

        // 2. Parse Content
        logger.info(`Parsing ${policyType} document...`);
        const contentHtml = await this.parseDocument(file.buffer, file.mimetype);

        // 3. Update DB
        // Determine next version
        const { data: latest, error: versionError } = await supabase
            .from('policy_pages')
            .select('version')
            .eq('policy_type', policyType)
            .order('version', { ascending: false })
            .limit(1)
            .single();

        let nextVersion = 1;
        if (!versionError && latest) {
            nextVersion = latest.version + 1;
        }

        // Deactivate old policies
        // We can do this atomically or sequentially. Sequential is fine here.
        await supabase
            .from('policy_pages')
            .update({ is_active: false })
            .eq('policy_type', policyType);

        // Insert new policy
        const { data, error: insertError } = await supabase
            .from('policy_pages')
            .insert({
                policy_type: policyType,
                title,
                content_html: contentHtml,
                storage_path: filePath,
                file_type: fileExt,
                version: nextVersion,
                is_active: true
            })
            .select()
            .single();

        if (insertError) {
            logger.error({ err: insertError }, 'Database insert failed');
            throw new Error(`Failed to save policy metadata: ${insertError.message}`);
        }

        return data;
    }

    async getActivePolicy(policyType) {
        const { data, error } = await supabase
            .from('policy_pages')
            .select('*')
            .eq('policy_type', policyType)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // No rows found
                return null;
            }
            throw error;
        }
        return data;
    }
}

module.exports = new PolicyService();
