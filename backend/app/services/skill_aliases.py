"""
Dictionnaire de normalisation des compétences (skills).

Groupes de synonymes : chaque tuple contient toutes les variantes connues.
Toutes les entrées d'un groupe sont mappées vers la PREMIÈRE valeur (forme
canonique). Cela garantit la symétrie : "typescript" ↔ "ts" matchent car
les deux sont normalisés vers "typescript".

Pour ajouter un nouveau synonyme, il suffit d'ajouter un tuple dans la
catégorie appropriée ou d'étendre un tuple existant.
"""

SKILL_SYNONYM_GROUPS: list[tuple[str, ...]] = [
    # ── Langages ──────────────────────────────────────────────
    ("typescript", "ts"),
    ("javascript", "js", "ecmascript", "es6", "es2015"),
    ("python", "python3", "python2", "py"),
    ("csharp", "c#", "c sharp", "dotnet", ".net", ".net core"),
    ("cpp", "c++", "cplusplus"),
    ("golang", "go"),
    ("ruby", "rb"),
    ("rust", "rustlang"),
    ("kotlin", "kt"),
    ("swift", "swiftlang"),
    ("r", "rlang", "r language"),
    ("matlab", "octave"),
    ("scala", "scala lang"),
    ("perl", "pl"),
    ("bash", "shell", "sh", "zsh", "shell scripting"),
    ("powershell", "pwsh"),
    ("php", "php8", "php7"),
    ("dart", "dartlang"),
    ("lua", "luajit"),
    ("assembly", "asm", "assembleur"),
    ("objective-c", "objc", "objective c"),
    ("vba", "visual basic", "vb.net", "vb"),

    # ── Frontend ──────────────────────────────────────────────
    ("react", "reactjs", "react.js", "react js"),
    ("vue", "vuejs", "vue.js", "vue js", "vue3", "vue 3"),
    ("angular", "angularjs", "angular.js", "angular js"),
    ("next", "nextjs", "next.js", "next js"),
    ("nuxt", "nuxtjs", "nuxt.js", "nuxt js"),
    ("svelte", "sveltejs", "sveltekit"),
    ("jquery", "j query"),
    ("tailwind", "tailwindcss", "tailwind css"),
    ("bootstrap", "bootstrap5", "bootstrap 5"),
    ("sass", "scss"),
    ("html", "html5", "html 5"),
    ("css", "css3", "css 3"),
    ("webpack", "wp"),
    ("vite", "vitejs"),

    # ── Backend / API ─────────────────────────────────────────
    ("node", "nodejs", "node.js", "node js"),
    ("express", "expressjs", "express.js"),
    ("fastapi", "fast api"),
    ("django", "django rest framework", "drf"),
    ("flask", "flask api"),
    ("spring", "spring boot", "springboot", "spring framework"),
    ("rails", "ruby on rails", "ror"),
    ("laravel", "laravel php"),
    ("nestjs", "nest.js", "nest js"),
    ("aspnet", "asp.net", "asp.net core"),
    ("graphql", "gql"),
    ("rest", "rest api", "restful", "api rest"),
    ("grpc", "g rpc"),

    # ── Bases de données ──────────────────────────────────────
    ("postgresql", "postgres", "pgsql", "pg"),
    ("mysql", "my sql"),
    ("mariadb", "maria db"),
    ("sql server", "mssql", "ms sql", "tsql", "t-sql"),
    ("mongodb", "mongo", "mongo db"),
    ("redis", "redis cache"),
    ("elasticsearch", "elastic", "elk"),
    ("cassandra", "apache cassandra"),
    ("dynamodb", "dynamo db", "aws dynamodb"),
    ("sqlite", "sqlite3"),
    ("oracle", "oracle db", "oracle database", "plsql", "pl/sql"),
    ("neo4j", "neo 4j"),
    ("couchdb", "couch db"),
    ("firebase", "firebase db", "firestore"),
    ("supabase", "supa base"),

    # ── Cloud / DevOps ────────────────────────────────────────
    ("aws", "amazon web services", "amazon aws"),
    ("gcp", "google cloud", "google cloud platform"),
    ("azure", "microsoft azure", "ms azure"),
    ("docker", "docker container"),
    ("kubernetes", "k8s", "kube"),
    ("terraform", "tf iac", "terraform iac"),
    ("ansible", "ansible automation"),
    ("jenkins", "jenkins ci"),
    ("github actions", "gh actions"),
    ("gitlab ci", "gitlab ci/cd", "gitlab cicd"),
    ("ci/cd", "cicd", "ci cd", "continuous integration"),
    ("nginx", "nginx server"),
    ("apache", "apache server", "httpd"),
    ("linux", "gnu/linux", "gnu linux"),
    ("helm", "helm charts"),
    ("prometheus", "prom"),
    ("grafana", "grafana dashboard"),
    ("vagrant", "vagrant vm"),
    ("pulumi", "pulumi iac"),
    ("cloudformation", "aws cloudformation", "cfn"),
    ("openshift", "okd", "redhat openshift"),

    # ── Data / ML / IA ────────────────────────────────────────
    ("machine learning", "ml", "apprentissage automatique"),
    ("deep learning", "dl", "apprentissage profond"),
    ("natural language processing", "nlp", "traitement du langage naturel"),
    ("artificial intelligence", "ai", "ia", "intelligence artificielle"),
    ("large language model", "llm", "llms"),
    ("computer vision", "vision par ordinateur"),
    ("tensorflow", "tf", "tensor flow"),
    ("pytorch", "torch", "py torch"),
    ("scikit-learn", "sklearn", "scikit learn", "sk-learn"),
    ("pandas", "pd"),
    ("numpy", "np"),
    ("matplotlib", "mpl", "mat plot lib"),
    ("jupyter", "jupyter notebook", "jupyter lab", "jupyterlab"),
    ("spark", "apache spark", "pyspark"),
    ("hadoop", "apache hadoop", "hdfs"),
    ("kafka", "apache kafka"),
    ("airflow", "apache airflow"),
    ("databricks", "data bricks"),
    ("mlflow", "ml flow"),
    ("hugging face", "huggingface", "hf"),
    ("opencv", "open cv", "cv2"),
    ("keras", "tf.keras"),
    ("xgboost", "xgb"),
    ("lightgbm", "lgbm"),
    ("tableau", "tableau desktop"),
    ("power bi", "powerbi", "power bi desktop"),
    ("looker", "looker studio", "google data studio"),
    ("dbt", "data build tool"),
    ("snowflake", "snowflake db"),
    ("bigquery", "big query", "google bigquery"),
    ("redshift", "aws redshift", "amazon redshift"),
    ("rag", "retrieval augmented generation"),

    # ── Mobile ────────────────────────────────────────────────
    ("react native", "rn", "react-native"),
    ("flutter", "flutter sdk"),
    ("android", "android sdk"),
    ("ios", "ios sdk", "apple ios"),
    ("expo", "expo react native"),
    ("xamarin", "xamarin forms"),
    ("ionic", "ionic framework"),

    # ── Outils / Méthodologies ────────────────────────────────
    ("git", "git scm"),
    ("jira", "atlassian jira"),
    ("confluence", "atlassian confluence"),
    ("figma", "figma design"),
    ("agile", "agilité", "méthodologie agile"),
    ("scrum", "scrum master", "méthode scrum"),
    ("kanban", "kanban board"),
    ("devops", "dev ops"),
    ("api", "apis", "web api"),
    ("microservices", "micro services", "architecture microservices"),
    ("soa", "service oriented architecture"),
    ("rabbitmq", "rabbit mq"),
    ("websocket", "websockets", "ws"),

    # ── Sécurité ──────────────────────────────────────────────
    ("cybersecurity", "cybersécurité", "cyber security", "infosec"),
    ("oauth", "oauth2", "oauth 2.0"),
    ("jwt", "json web token"),
    ("ssl", "tls", "ssl/tls"),
    ("sso", "single sign on"),

    # ── Testing ───────────────────────────────────────────────
    ("unit testing", "tests unitaires", "unit tests"),
    ("selenium", "selenium webdriver"),
    ("cypress", "cypress.io"),
    ("jest", "jest js"),
    ("pytest", "py.test"),
    ("postman", "postman api"),
]


def build_skill_aliases() -> dict[str, str]:
    """
    Génère le dictionnaire d'alias à partir des groupes de synonymes.
    Chaque variante est mappée vers la forme canonique (premier élément).
    """
    aliases: dict[str, str] = {}
    for group in SKILL_SYNONYM_GROUPS:
        canonical = group[0]
        for variant in group[1:]:
            aliases[variant] = canonical
    return aliases


# Dictionnaire pré-calculé à l'import du module
SKILL_ALIASES = build_skill_aliases()
