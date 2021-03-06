import { actor } from "./actor";
/**
 *
 * @since v3
 */
export interface search_code {
    /**
     *
     * @since v3
     */
    items?: Array<{
        git_url?: string;
        html_url?: string;
        name?: string;
        path?: string;
        repository?: {
            archive_url?: string;
            assignees_url?: string;
            blobs_url?: string;
            branches_url?: string;
            collaborators_url?: string;
            comments_url?: string;
            commits_url?: string;
            compare_url?: string;
            contents_url?: string;
            contributors_url?: string;
            description?: string;
            downloads_url?: string;
            events_url?: string;
            fork?: boolean;
            forks_url?: string;
            full_name?: string;
            git_commits_url?: string;
            git_refs_url?: string;
            git_tags_url?: string;
            hooks_url?: string;
            html_url?: string;
            id?: int64;
            issue_comment_url?: string;
            issue_events_url?: string;
            issues_url?: string;
            keys_url?: string;
            labels_url?: string;
            languages_url?: string;
            merges_url?: string;
            milestones_url?: string;
            name?: string;
            notifications_url?: string;
            owner?: actor;
            private?: boolean;
            pulls_url?: string;
            stargazers_url?: string;
            statuses_url?: string;
            subscribers_url?: string;
            subscription_url?: string;
            tags_url?: string;
            teams_url?: string;
            trees_url?: string;
            url?: string;
        };
        score?: double;
        sha?: string;
        url?: string;
    }>;
    /**
     *
     * @since v3
     */
    total_count?: int64;
}
