# What is Terraform?

Terraform is an Infrastructure as Code (IaC) service that allows you to define resources you want to provision somewhere (in this case in Google Cloud) as code, rather than creating the resources manually yourself.

# What is the benefit?

In an industry setting, having your infrastructure written as code is great as it means that if something were to happen to it (it was accidentally deleted), you can very easily recreated everything using terraform with a single command, rather than having to manually do it all.

* An important note is that if you have a database this doesn't mean it can recover the data, only the information about the database itself. You need to have another protection measure to backup lost data.

It also allows you to manage the state of your infrastructure through a version control tool such as github, meaning that if something was created or changed, you can track down exactly when and who did it via github.

# Why do we need it?

We don't lol. I use terraform at work but i have not personally myself and I think it would be a cool thing to try out.

In reality we probably will use it once and completely forget about it, but it's good to know as these sorts of IaC serviecs are extremely common in industry.

Another common use is to handle permissions. If you want people to be able to provision a resource but only after they've been given approval, you can configure it so only a serviceaccount using terraform has permission to create that resource, therefore they have to create a pull request to provision it.

# How do i use it?

You can follow the installation instructions [here](https://developer.hashicorp.com/terraform/tutorials/gcp-get-started/google-cloud-platform-build).

To add new infrastructure you simply define it in the `main.tf` file as a resource, as well as any variables you have in the `variables.tf` and the values of them in the `terraform.tfvars`.

You can run `terraform plan` to see what terraform expects to create from the code you have written.

You can then run `terraform apply` and `yes` shortly after to have it automatically provision those resources for you.

There are many more powerful ways to use terraform, such as defining modules, having variables differ between non production and production infrastructure, and other cool stuff, but what I've written here is a very bare bones introduction to what terraform can offer.

# Other IaC services (and where terraform lacks)

One thing you'll notice when using terraform if that the infrastructure it provisions can become stale, meaning that the state is only kept up to date as long as you are reguarly running terraform apply. There are many other IaC services which attempt to fix this, primarily but running a [pod](https://kubernetes.io/docs/concepts/workloads/pods/) or [operator ](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)on [kubernetes](https://kubernetes.io/). Here are a list of them I am familiar with.

- Flux
- Google Config Connector
- Crossplane
- OpenTofu

These all have their quirks but they all operate as ways to store the state of your infrastructure as code rather than purely through click-ops.
